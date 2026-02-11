@echo off
title Guardian System - Compilador Automatico
color 0A

echo ==========================================
echo      INICIANDO PROTOCOLO DE BUILD
echo ==========================================
echo.

:: 1. Limpa versões antigas para evitar conflito
echo [1/4] Limpando arquivos antigos (dist/build)...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
echo       Limpeza concluida.
echo.

:: 2. Gera o Executável com PyInstaller
echo [2/4] Gerando o Executavel (Isso pode demorar um pouco)...
pyinstaller --name="GuardianSystem" --noconsole --icon=guardian.ico desktop.py
echo       Executavel gerado.
echo.

:: 3. Copia a estrutura de pastas (App, Data, Storage)
echo [3/4] Organizando a logistica de arquivos...

:: Copia a pasta 'app' inteira (Templates e Static)
xcopy "app" "dist\GuardianSystem\app" /E /I /Y /Q

:: Cria a pasta 'data' vazia
if not exist "dist\GuardianSystem\data" mkdir "dist\GuardianSystem\data"

:: Cria a pasta 'storage' vazia
if not exist "dist\GuardianSystem\storage" mkdir "dist\GuardianSystem\storage"

:: Copia a imagem de Splash (guardian.png)
if exist guardian.png copy guardian.png "dist\GuardianSystem\" >nul
echo       Pastas e arquivos organizados.
echo.

:: 4. Finalização
echo [4/4] OPERACAO CONCLUIDA!
echo ==========================================
echo.
echo O sistema pronto para entrega esta na pasta:
echo dist\GuardianSystem
echo.
pause