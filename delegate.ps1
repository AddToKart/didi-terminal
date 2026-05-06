param (
    [Parameter(Mandatory=$true)]
    [string]$Target,

    [Parameter(Mandatory=$true)]
    [string]$Task
)

$msgObj = @{
    target = $Target
    payload = $Task
    kind = if ($Task -match '^\s*(Task complete|Done|Completed|Finished|Status|FYI|Ack|Acknowledged)\b') { "completion" } else { "task" }
    sender = if ([string]::IsNullOrEmpty($env:AGENT_NAME)) { "Main" } else { $env:AGENT_NAME }
    taskId = [guid]::NewGuid().ToString("N")
    parentTaskId = ""
}
$msg = $msgObj | ConvertTo-Json -Compress

try {
    $pipe = New-Object System.IO.Pipes.NamedPipeClientStream(".", "agentbus", [System.IO.Pipes.PipeDirection]::Out)
    $pipe.Connect(2000)
    $writer = New-Object System.IO.StreamWriter($pipe)
    $writer.Write($msg)
    $writer.Dispose()
    $pipe.Dispose()
    Write-Host "Delegated task to '$Target' successfully." -ForegroundColor Green
} catch {
    Write-Error "Failed to delegate task to $Target. Is the Orchestrator running? Error: $_"
}
