@echo off
title Guardian System - Iniciando...
echo Iniciando o sistema... Por favor aguarde a janela abrir.
cd /d "%~dp0"

:: O comando abaixo roda o Python sem abrir a janela preta do terminal (pythonw)
start "" "pythonw" desktop.py

exit