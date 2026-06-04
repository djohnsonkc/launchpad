param(
    [Parameter(Mandatory = $true)]
    [string]$WebhookUrl,

    [Parameter(Mandatory = $true)]
    [string]$Tag,

    [Parameter(Mandatory = $true)]
    [string]$ServiceName,

    [int]$MaxRetries = 3,
    [int]$RetryDelay = 5,
    [int]$Timeout = 30
)

Write-Host "Deploying $ServiceName with tag: $Tag"

# Validate webhook URL exists
if ([string]::IsNullOrEmpty($WebhookUrl)) {
    Write-Error "Webhook URL for $ServiceName is not configured"
    exit 1
}

# Construct full URL with SERVICE_TAG parameter (Portainer stack webhook format)
$fullUrl = "${WebhookUrl}?SERVICE_TAG=${Tag}"
Write-Host "Webhook URL: $fullUrl"

# Attempt webhook POST with retries
for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {
    Write-Host "Attempt $attempt of $MaxRetries..."

    # Suppress PowerShell errors from curl stderr output
    $ErrorActionPreference = 'SilentlyContinue'

    # Execute curl with timeout and capture output
    $output = curl.exe -s -v -X "POST" `
        --max-time $Timeout `
        --retry 0 `
        --fail-with-body `
        -w "`nHTTP_CODE:%{http_code}" `
        "$fullUrl" 2>&1

    $ErrorActionPreference = 'Continue'
    $curlExitCode = $LASTEXITCODE

    # Extract HTTP status code using explicit regex
    $httpCode = "000"
    $match = [regex]::Match($output, "HTTP_CODE:(\d+)")
    if ($match.Success) {
        $httpCode = $match.Groups[1].Value
    }

    Write-Host "Curl Exit Code: $curlExitCode"
    Write-Host "HTTP Status Code: $httpCode"
    Write-Host "Full Response:"
    Write-Host $output

    # Check if curl succeeded (exit code 0 or 22 for HTTP errors with --fail-with-body)
    if ($curlExitCode -eq 0 -or $curlExitCode -eq 22) {
        # Check if successful (2xx status codes)
        $httpCodeInt = [int]$httpCode
        if ($httpCodeInt -ge 200 -and $httpCodeInt -lt 300) {
            Write-Host "Successfully triggered webhook for $ServiceName (HTTP $httpCode)" -ForegroundColor Green
            exit 0
        }
        else {
            Write-Warning "Received non-success status code: $httpCode"
        }
    }
    else {
        Write-Warning "Curl failed with exit code: $curlExitCode"
    }

    # Retry logic
    if ($attempt -lt $MaxRetries) {
        Write-Host "Retrying in $RetryDelay seconds..."
        Start-Sleep -Seconds $RetryDelay
    }
}

# All retries exhausted
Write-Error "Failed to trigger webhook for $ServiceName after $MaxRetries attempts"
exit 1
