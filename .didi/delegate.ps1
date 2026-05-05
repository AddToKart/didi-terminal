param (
    [Parameter(Mandatory=$true)]
    [string]$Target,

    [Parameter(Mandatory=$true)]
    [string]$Task
)

$sender = $env:AGENT_NAME
if ([string]::IsNullOrEmpty($sender)) { $sender = "Main" }

# Append autonomous callback instructions so the receiving agent knows who to report back to
$enrichedTask = "[$sender DELEGATED A TASK]: $Task`n[SYSTEM RULE: When you finish this task, you MUST report back to $sender by running: .didi\delegate $sender `"Task complete: <summary>`"]"

$msgObj = @{
    target = $Target
    payload = $enrichedTask
}
$msg = $msgObj | ConvertTo-Json -Compress

try {
    $pipe = New-Object System.IO.Pipes.NamedPipeClientStream(".", "agentbus", [System.IO.Pipes.PipeDirection]::Out)
    $pipe.Connect(2000)
    $writer = New-Object System.IO.StreamWriter($pipe)
    $writer.Write($msg)
    $writer.Dispose()
    $pipe.Dispose()
    Write-Host "Delegated task to '$Target' successfully. Now waiting for them to report back." -ForegroundColor Green
} catch {
    Write-Error "Failed to delegate task to $Target. Error: $_"
}
