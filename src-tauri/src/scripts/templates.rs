/// Returns the contents of `.didi/delegate.ps1`.
pub fn delegate_ps1() -> &'static str {
    r#"param (
    [Parameter(Mandatory=$true)]
    [string]$Target,

    [Parameter(Mandatory=$true)]
    [string]$Task,

    # Optional: override who the receiver should report back to.
    # Use this when chaining specialists so Documentator reports to Orchestrator, not to Builder.
    [string]$ReportTo = ""
)

$workspace = Split-Path -Parent $PSScriptRoot
$env:DIDI_WORKSPACE = $workspace
Set-Location -LiteralPath $workspace

$sender = $env:AGENT_NAME
if ([string]::IsNullOrEmpty($sender)) { $sender = "Main" }

$reportTarget = if ([string]::IsNullOrEmpty($ReportTo)) { $sender } else { $ReportTo }

$isCompletion = $Task -match '^\s*(Task complete|Done|Completed|Finished|Status|FYI|Ack|Acknowledged)\b'
$isCompletion = $isCompletion -or ($Task -match 'completion callback')
$taskId = [guid]::NewGuid().ToString("N")

# --- Auto-manage ### Agent Queue in_progress markers (NEVER touches ### Tasks) ---
$planPath = Join-Path $workspace "MASTER_PLAN.md"
$targetTaskLine = ""
if (Test-Path $planPath) {
    $planLines = Get-Content $planPath
    $inQueue = $false
    $updatedLines = @()
    $isChaining = (!$isCompletion -and ![string]::IsNullOrEmpty($ReportTo) -and $ReportTo -ne $sender)

    foreach ($line in $planLines) {
        # Track which section we are in
        if ($line -match "^###\s+Agent Queue") { $inQueue = $true }
        elseif ($line -match "^###" -and $line -notmatch "^###\s+Agent Queue") { $inQueue = $false }

        if ($inQueue) {
            if ($isCompletion -or $isChaining) {
                # Mark sender as waiting_completion
                if ($line -match "(?i)^-\s*\[.\]\s*$([regex]::Escape($sender))[:\s]") {
                    $line = $line -replace "\s*<!--\s*didi:status=(in_progress|todo|in_queue|waiting_completion)\s*-->", ""
                    $line = "$line <!-- didi:status=waiting_completion -->"
                }
            }
            
            if (!$isCompletion) {
                # Add in_queue to ALL pending queue entries that don't have a status
                if ($line -match "^-\s*\[ \]" -and $line -notmatch "didi:status=") {
                    $line = "$line <!-- didi:status=in_queue -->"
                }
                
                # If Target is receiving task, mark them in_progress
                if ($line -match "(?i)^-\s*\[.\]\s*$([regex]::Escape($Target))[:\s]") {
                    $line = $line -replace "\s*<!--\s*didi:status=(todo|in_queue|waiting_completion)\s*-->", ""
                    if ($line -notmatch "didi:status=in_progress") {
                        $line = "$line <!-- didi:status=in_progress -->"
                    }
                    if (!$targetTaskLine) { $targetTaskLine = $line.Trim() }
                }
            }
        }
        $updatedLines += $line
    }

    $updatedLines | Set-Content $planPath
}
# --- End Agent Queue management ---

if ($isCompletion) {
    $kind = "completion"
    $payload = "[$sender COMPLETED TASK]: $Task`n[SYSTEM RULE: This is a terminal status update. Do not acknowledge it, do not report back, and do not delegate a response unless this message explicitly assigns a new task.]"
} else {
    $kind = "task"
    $hint = if ($targetTaskLine) { "Your assignment line in MASTER_PLAN.md is: [$targetTaskLine]. Add YOUR subtasks in the '### Tasks' section below it." } else { "Find your assignment in '### Agent Queue' section of MASTER_PLAN.md." }
    $payload = "[$sender DELEGATED A TASK]: $Task`n[SYSTEM RULE: You are a SPECIALIST. $hint You MUST NOT add any new entries to the '### Agent Queue' section — that is read-only for specialists. Write your own work checklist in '### Tasks' only. Do the work. When done, you MUST execute this exact shell command in your terminal (do NOT just print it in text): .didi\delegate $reportTarget `"Task complete: <summary>`". If chaining: execute shell command .didi\delegate <Next> `"<task>`" -ReportTo $reportTarget then STOP — do NOT also send your own callback.]"
}

$msgObj = @{
    target = $Target
    payload = $payload
    kind = $kind
    sender = $sender
    taskId = $taskId
    parentTaskId = ""
}
$msg = $msgObj | ConvertTo-Json -Compress

function Send-BusMessage($json) {
    $p = New-Object System.IO.Pipes.NamedPipeClientStream(".", "agentbus", [System.IO.Pipes.PipeDirection]::Out)
    try {
        $p.Connect(2000)
        $w = New-Object System.IO.StreamWriter($p)
        $w.AutoFlush = $true
        $w.Write($json)
        $w.Flush()
    } finally {
        if ($w) { try { $w.Dispose() } catch {} }
        if ($p) { try { $p.Dispose() } catch {} }
    }
}

try {
    Send-BusMessage $msg

    # When chaining with -ReportTo, auto-emit a completion for the sender
    # so the UI task tracker marks their task done without a double-report.
    if (!$isCompletion -and ![string]::IsNullOrEmpty($ReportTo) -and $ReportTo -ne $sender) {
        Start-Sleep -Milliseconds 300
        $autoComplete = @{
            target = $reportTarget
            payload = "[$sender COMPLETED TASK]: Chained work to $Target.`n[SYSTEM RULE: This is a terminal status update. Do not acknowledge it or delegate a response.]"
            kind = "completion"
            sender = $sender
            taskId = [guid]::NewGuid().ToString("N")
            parentTaskId = ""
        } | ConvertTo-Json -Compress
        Send-BusMessage $autoComplete
    }
    if ($kind -eq "completion") {
        Write-Host "Sent completion update to '$Target'. No response is expected." -ForegroundColor Green
    } else {
        Write-Host "Delegated task to '$Target'. They will report to '$reportTarget'." -ForegroundColor Green
        Write-Host "STOP NOW: do not poll files, sleep, or send your own callback if you chained." -ForegroundColor Yellow
    }
} catch {
    Write-Error "Failed to delegate task to $Target. Error: $_"
}
"#
}

/// Returns the contents of `.didi/delegate.cmd`.
pub fn delegate_cmd() -> &'static str {
    r#"@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0delegate.ps1" %*
"#
}

/// Returns the contents of `.didi/context.ps1`.
pub fn context_ps1() -> &'static str {
    r#"
$workspace = Split-Path -Parent $PSScriptRoot
$env:DIDI_WORKSPACE = $workspace
Set-Location -LiteralPath $workspace

Write-Host "--- DIDI CONTEXT SNAPSHOT ---" -ForegroundColor Cyan
Write-Host "`n[0] WORKSPACE ROOT: $workspace" -ForegroundColor Yellow

Write-Host "`n[1] PROJECT STRUCTURE (Max depth 2):" -ForegroundColor Yellow
if (Get-Command tree -ErrorAction SilentlyContinue) {
    tree /F /A | Select-String -NotMatch "node_modules|target|\.git" | Select-Object -First 30
} else {
    Get-ChildItem -Depth 2 -Exclude "node_modules","target",".git" | Select-Object FullName
}

Write-Host "`n[2] GIT STATUS:" -ForegroundColor Yellow
if (Test-Path ".git") {
    git status -s
} else {
    Write-Host "Not a git repository."
}

Write-Host "`n[3] MASTER PLAN PENDING TASKS:" -ForegroundColor Yellow
if (Test-Path "MASTER_PLAN.md") {
    Get-Content "MASTER_PLAN.md" | Select-String -Pattern "- \[ \]" | Select-Object -First 5
} else {
    Write-Host "No MASTER_PLAN.md found."
}

Write-Host "`n--- END OF SNAPSHOT ---" -ForegroundColor Cyan
"#
}

/// Returns the contents of `.didi/context.cmd`.
pub fn context_cmd() -> &'static str {
    r#"@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0context.ps1"
"#
}

/// Returns the content written to `AGENTS.md` in the workspace root.
pub fn agents_md() -> &'static str {
    r#"# DidiTerminal - Autonomous Collaboration Protocol

You are an AI Agent running inside the DidiTerminal Orchestrator.
You are part of a multi-agent team. Communicate ONLY through the local `.didi\delegate` command.
CRITICAL: YOU MUST NOT SEND CODE IN YOUR MESSAGES. Point to files instead.
The workspace root is `$env:DIDI_WORKSPACE`. All file reads/writes must stay within it.

---

## ORCHESTRATOR PROTOCOL

> You are the Orchestrator if the human addressed you directly.

### Step 1 — Write ALL assignments into `### Agent Queue` in MASTER_PLAN.md BEFORE delegating anyone.
Write ONE entry per specialist. Use this exact format:
```
- [ ] Builder: <what Builder must do>
- [ ] Documentator: <what Documentator must do>
```
Do NOT write to `### Tasks`. That section is for specialists. `### Agent Queue` is yours only.

### Step 2 — Delegate to the FIRST specialist only.
Use `.didi\delegate` with `-ReportTo Orchestrator` if the first specialist must chain to a second one.
Example (Builder chains to Documentator, both report to you):
```
.didi\delegate Builder "Build the landing page. When done, delegate to Documentator with -ReportTo Orchestrator." -ReportTo Orchestrator
```
Do NOT delegate to Documentator yourself. Builder will do that.

### Step 3 — STOP COMPLETELY. Do not do any of the following:
- Do NOT run Start-Sleep, sleep, or any waiting loop.
- Do NOT glob files, ls, dir, or check if files appeared.
- Do NOT re-read MASTER_PLAN.md to check progress.
- Do NOT think about whether Builder has finished.
- Do NOT send any more messages until a completion callback arrives.
You are now idle. The system will resume you when the callback comes in.

### Step 4 — When ALL callbacks arrive:
- Mark each top-level task as `[x]` in the `### Agent Queue` in MASTER_PLAN.md to move them to the 'Done' column.
- Notify the human that all tasks are complete.

---

## SPECIALIST PROTOCOL

> You are a Specialist (Builder, Documentator, etc.) if you received a delegated task.

### Step 1 — Read your assignment from `### Agent Queue` in MASTER_PLAN.md. DO NOT add to that section.
Your entry is already there. The delegation system marked it `in_progress` automatically.

### Step 2 — Write your own work items in `### Tasks` section.
Add your subtask checklist ONLY in the `### Tasks` section (not Agent Queue).
```
### Tasks
- [ ] Create index.html skeleton
- [ ] Add hero section
- [ ] Add menu section
```
Check them off as you go.

### Step 3 — Do the work. Check off your subtasks as you go.

### Step 4 — Chain or Report.
**If the task says to chain to another specialist:**
```
.didi\delegate Documentator "Document the landing page at index.html and write README.md" -ReportTo Orchestrator
```
Then STOP. Do NOT send a completion callback yourself. The next specialist will report to Orchestrator for you.

**If no chaining is needed:**
```
.didi\delegate Orchestrator "Task complete: <one-line summary>"
```
Then STOP.

---

## RULES (apply to everyone)

### Rule 1 — MASTER_PLAN.md ownership
- Orchestrator: writes top-level tasks. Only Orchestrator marks top-level tasks `[x]`.
- Specialists: add/edit only their own indented subtasks.
- No specialist may add a new top-level task. Ever.

### Rule 2 — One delegate call per handoff. No chatter.
Do not delegate acknowledgements, progress updates, or confirmations.

### Rule 3 — Never double-report when chaining
If you chained to a next specialist, you are done. Do NOT also send a callback to your sender.
The next specialist owns the loop closure.

### Rule 4 — Orchestrator wait state is absolute
After delegating, Orchestrator does nothing until it receives a callback. No monitoring. No polling. No sleeping.

### Rule 5 — Context gathering
If lost, run `.didi\context` for directory tree, git status, and MASTER_PLAN pending tasks. Do not guess.

### Rule 6 — Sentinel recovery
If warned that you are looping on a failed command, stop and try a different approach.
"#
}

/// Returns the new-format `MASTER_PLAN.md` bootstrap content.
pub fn master_plan_md() -> &'static str {
    r#"# Project Master Plan

## Current Phase: Active Work

### Agent Queue
<!-- Orchestrator writes delegation assignments here. Specialists: DO NOT add entries to this section. -->

### Tasks
<!-- Specialists write their own work items here freely. -->
"#
}

/// Returns the old legacy `MASTER_PLAN.md` bootstrap that gets replaced on re-init.
pub fn legacy_master_plan_md() -> &'static str {
    r#"# Project Master Plan

## Current Phase: Planning

### Tasks
- [ ] Define architecture and state logic.
- [ ] Implement backend components.
- [ ] Implement frontend components.
- [ ] Testing and finalization.
"#
}
