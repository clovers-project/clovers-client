import os

flag = __name__ == "__main__"

while flag:
    command = input()
    if command.startswith("clovers"):
        command = f"python.exe -m clovers_cli {command[7:].strip()}"
    os.system(command)

# ..\.venv\Scripts\python.exe -m clovers_cli
