from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import requests
import json

import database
from database import SessionLocal, FAQ, Conversation, Message, init_db
from matcher import FAQMatcher

app = FastAPI(title="Ojas Chat API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
init_db()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Seed default FAQs if DB is empty
def seed_faqs():
    db = SessionLocal()
    try:
        if db.query(FAQ).count() == 0:
            defaults = [
                FAQ(question="What is this service?", answer="This is an offline AI chatbot assistant that helps answer customer questions instantly.", category="General"),
                FAQ(question="Do you require an internet connection?", answer="No, this chatbot runs completely offline. It uses local matching and local models for generating answers.", category="Technical"),
                FAQ(question="How do I integrate this chatbot into my website?", answer="You can embed the chat widget by adding our React component to your website or linking to our frontend widget script.", category="Integration"),
                FAQ(question="What features does the admin dashboard have?", answer="The admin dashboard allows you to add/edit/delete FAQs, train the bot, view real-time chat histories, and check configuration settings.", category="Dashboard"),
            ]
            db.add_all(defaults)
            db.commit()
    finally:
        db.close()

seed_faqs()

# Pydantic Schemas
class FAQSchema(BaseModel):
    id: Optional[int] = None
    question: str
    answer: str
    category: str = "General"

    class Config:
        from_attributes = True

class MessageSchema(BaseModel):
    sender: str
    text: str

class ChatRequest(BaseModel):
    conversation_id: int
    message: str

# Endpoints
@app.get("/api/faqs", response_model=List[FAQSchema])
def get_faqs(db: Session = Depends(get_db)):
    return db.query(FAQ).all()

@app.post("/api/faqs", response_model=FAQSchema)
def create_faq(faq: FAQSchema, db: Session = Depends(get_db)):
    db_faq = FAQ(question=faq.question, answer=faq.answer, category=faq.category)
    db.add(db_faq)
    db.commit()
    db.refresh(db_faq)
    return db_faq

@app.delete("/api/faqs/{faq_id}")
def delete_faq(faq_id: int, db: Session = Depends(get_db)):
    db_faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not db_faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    db.delete(db_faq)
    db.commit()
    return {"detail": "FAQ deleted successfully"}

@app.post("/api/conversations")
def create_conversation(db: Session = Depends(get_db)):
    conv = Conversation()
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {"conversation_id": conv.id}

@app.get("/api/conversations")
def get_conversations(db: Session = Depends(get_db)):
    convs = db.query(Conversation).order_by(Conversation.created_at.desc()).all()
    result = []
    for c in convs:
        last_msg = db.query(Message).filter(Message.conversation_id == c.id).order_by(Message.timestamp.desc()).first()
        result.append({
            "id": c.id,
            "created_at": c.created_at,
            "last_message": last_msg.text if last_msg else "No messages yet"
        })
    return result

@app.get("/api/conversations/{conv_id}/messages")
def get_conversation_messages(conv_id: int, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.timestamp.asc()).all()

# Ollama integration check helper
def query_ollama(prompt: str, system_prompt: str = "") -> Optional[str]:
    ollama_url = "http://localhost:11434/api/generate"
    payload = {
        "model": "llama3",  # default model, can be configured
        "prompt": prompt,
        "system": system_prompt,
        "stream": False
    }
    try:
        response = requests.post(ollama_url, json=payload, timeout=8)
        if response.status_code == 200:
            return response.json().get("response")
    except Exception:
        # If llama3 isn't loaded, try general offline fallback or minor models if needed
        pass
    return None

@app.post("/api/chat")
def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    # 1. Verify conversation
    conv = db.query(Conversation).filter(Conversation.id == request.conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # 2. Save User Message
    user_msg = Message(conversation_id=request.conversation_id, sender="user", text=request.message)
    db.add(user_msg)
    db.commit()

    # 3. Match user query to FAQs
    all_faqs = db.query(FAQ).all()
    faq_dicts = [{"id": f.id, "question": f.question, "answer": f.answer} for f in all_faqs]
    
    bot_response = ""
    match_found = False
    
    if faq_dicts:
        matcher = FAQMatcher(faq_dicts)
        match, score = matcher.find_best_match(request.message, threshold=0.2)
        if match:
            bot_response = match['answer']
            match_found = True
            
    # 4. If no good direct FAQ match, try local generative AI (Ollama)
    if not match_found:
        # Build context from all FAQs
        faq_context = "\n".join([f"Q: {f.question}\nA: {f.answer}" for f in all_faqs])
        system_prompt = (
            "You are a helpful customer support assistant. You MUST answer the user's question based strictly on the "
            "provided FAQ context. If the answer is not in the context, politely explain that you don't know and "
            "recommend contacting support."
        )
        prompt = f"FAQ Context:\n{faq_context}\n\nUser Question: {request.message}\nAssistant:"
        
        # Try local LLM
        ollama_response = query_ollama(prompt, system_prompt)
        if ollama_response:
            bot_response = ollama_response.strip()
        else:
            # Complete offline fallback when Ollama is not active/installed
            bot_response = "I'm sorry, I couldn't find a precise match for that question. Let me know if you would like me to connect you with a representative."

    # 5. Save Bot Message
    bot_msg = Message(conversation_id=request.conversation_id, sender="bot", text=bot_response)
    db.add(bot_msg)
    db.commit()
    db.refresh(bot_msg)

    return bot_msg

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
