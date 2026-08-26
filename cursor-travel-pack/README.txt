Travel pack template (scripts only)

Generate a real pack on your source PC:
  cd relay
  powershell -ExecutionPolicy Bypass -File .\scripts\pack-cursor-chat.ps1

That creates agent-transcripts/ locally. Copy the whole cursor-travel-pack folder
to a USB drive — do NOT commit transcripts (they may contain secrets from chat).

On the laptop:
1. Install the IDE, sign in, open your Relay folder.
2. Quit the IDE completely (including tray).
3. powershell -ExecutionPolicy Bypass -File .\restore-cursor-chat.ps1 -TargetWorkspace "C:\Users\YOU\Notion 2"
4. Open the IDE again on that folder.
