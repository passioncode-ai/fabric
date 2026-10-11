@echo off
rem Fabric's MCP entry for a coding agent opened outside Fabric (ADR-0134): register it once, with no secret.
rem It runs Fabric's own Electron as Node on the bundled proxy: <install>\resources\bin\fabric-mcp.cmd
set ELECTRON_RUN_AS_NODE=1
"%~dp0..\..\Fabric.exe" "%~dp0..\app.asar\out\main\fabric-mcp.js" %*
