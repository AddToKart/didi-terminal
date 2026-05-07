param (
    [Parameter(Mandatory=$true)]
    [string]$Target,

    [Parameter(Mandatory=$true)]
    [string]$Task
)

$sender = $env:AGENT_NAME
if ([string]::IsNullOrEmpty($sender)) { $sender = "Main" }

$isCompletion = $Task -match '^\s*(Task complete|Done|Completed|Finished|Status|FYI|Ack|Acknowledged)\b'
if ($isCompletion) {
    $kind = "completion"
    $enrichedTask = "[$sender COMPLETED TASK]: $Task`n[SYSTEM RULE: This is a terminal status update. Do not acknowledge it, do not report back, and do not delegate a response unless this message explicitly assigns a new task.]"
} else {
    $kind = "task"
    $enrichedTask = "[$sender DELEGATED A TASK]: $Task`n[SYSTEM RULE: This is a peer-to-peer handoff from $sender. Do this task exactly once. You may add or complete indented subtasks in MASTER_PLAN.md, but do not mark the top-level task done unless you are Orchestrator. Default behavior: when your assigned work is done, report completion back to $sender by running .didi\delegate $sender `"Task complete: <summary>`". Only delegate to another specialist if the task explicitly asks for review/docs/follow-up work, or if you are blocked and need that specialist. Do not ask the human whether to report back. If you delegate the work to another agent, stop immediately after the delegate command and wait for their completion callback; do not poll files, inspect progress, retry the task yourself, or use internal subagent/Task tools to replace the delegated agent. After sending a completion callback, stop.]"
}

$msgObj = @{
    target = $Target
    payload = $enrichedTask
    kind = $kind
    sender = $sender
}
$msg = $msgObj | ConvertTo-Json -Compress

try {
    $pipe = New-Object System.IO.Pipes.NamedPipeClientStream(".", "agentbus", [System.IO.Pipes.PipeDirection]::Out)
    $pipe.Connect(2000)
    $writer = New-Object System.IO.StreamWriter($pipe)
    $writer.AutoFlush = $true
    $writer.Write($msg)
    $writer.Flush()
    if ($kind -eq "completion") {
        Write-Host "Sent completion update to '$Target'. No response is expected." -ForegroundColor Green
    } else {
        Write-Host "Delegated task to '$Target' successfully. Waiting for one completion callback." -ForegroundColor Green
        Write-Host "STOP NOW: do not inspect files, poll for progress, retry, or do the delegated work yourself. Resume only when '$Target' sends a completion callback." -ForegroundColor Yellow
    }
} catch {
    Write-Error "Failed to delegate task to $Target. Error: $_"
} finally {
    if ($writer) {
        try { $writer.Dispose() } catch {}
    }
    if ($pipe) {
        try { $pipe.Dispose() } catch {}
    }
}
