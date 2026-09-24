@echo off
title LIFE RPG - 放行防火墙端口 8899
echo ============================================
echo   LIFE RPG - 防火墙端口放行工具
echo ============================================
echo.

:: 检查是否管理员
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] 请右键此文件，选择"以管理员身份运行"。
    echo.
    pause
    exit /b 1
)

:: 添加入站规则放行 8899 端口（TCP）
netsh advfirewall firewall add rule name="LIFE RPG 8899" dir=in action=allow protocol=TCP localport=8899

if %errorLevel% equ 0 (
    echo.
    echo [成功] 端口 8899 已放行！
    echo.
    echo 现在手机和电脑连接同一个 WiFi，
    echo 在手机浏览器打开： http://10.225.50.113:8899
    echo.
) else (
    echo.
    echo [失败] 添加规则出错，请手动操作。
    echo.
)

pause
