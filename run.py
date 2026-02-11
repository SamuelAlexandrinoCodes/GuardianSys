import uvicorn

if __name__ == "__main__":
    # Reload=True permite que você altere o código e o site atualize sozinho
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)