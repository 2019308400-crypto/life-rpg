$root = "E:\LIFE RPJ"
$port = 8899
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
$listener.Start()
Write-Output "RAW TCP server on 0.0.0.0:$port (no admin needed)"

$mimes = @{
  ".html" = "text/html; charset=utf-8"
  ".htm"  = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".woff2"= "font/woff2"
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 5000
    $client.SendTimeout = 5000
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { $client.Close(); continue }

    # Read and discard headers
    while ($line = $reader.ReadLine()) { if ($line -eq "") { break } }

    $parts = $requestLine -split " "
    $rawUrl = $parts[1]
    $path = [System.Uri]::UnescapeDataString(($rawUrl -split "\?")[0])
    if ($path -eq "/") { $path = "/index.html" }

    $full = [System.IO.Path]::GetFullPath((Join-Path $root $path.TrimStart("/")))
    if (-not $full.StartsWith($root)) { $code = 403; $body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden") }
    elseif (Test-Path $full -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $mime = if ($mimes.ContainsKey($ext)) { $mimes[$ext] } else { "application/octet-stream" }
      $body = [System.IO.File]::ReadAllBytes($full)
      $code = 200
    } else { $code = 404; $body = [System.Text.Encoding]::UTF8.GetBytes("Not Found"); $mime = "text/plain" }

    if ($code -eq 200) {
      $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nAccess-Control-Allow-Origin: *`r`n`r`n"
    } else {
      $reason = if ($code -eq 404) { "Not Found" } else { "Forbidden" }
      $header = "HTTP/1.1 $code $reason`r`nContent-Type: text/plain`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
    }
    $hbytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($hbytes, 0, $hbytes.Length)
    if ($body) { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
  } catch {
    # ignore per-connection errors
  } finally {
    Start-Sleep -Milliseconds 10
    try { $client.Close() } catch {}
  }
}
