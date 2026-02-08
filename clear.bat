for /f "delims=" %%d in ('dir /s /b /a:d "__pycache__"') do (
    rmdir /s /q "%%d"
)