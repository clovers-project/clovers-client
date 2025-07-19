echo �������� __pycache__ Ŀ¼...
for /f "delims=" %%d in ('dir /s /b /a:d "__pycache__"') do (
    echo ɾ��: %%d
    rmdir /s /q "%%d"
)
echo �������!