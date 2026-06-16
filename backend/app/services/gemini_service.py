import google.generativeai as genai
import json
import urllib.request
import urllib.parse
import urllib.error
import time
from typing import List, Dict, Any, Generator
import app.config as config

# Configure the SDK
if config.GEMINI_API_KEY:
    genai.configure(api_key=config.GEMINI_API_KEY)

def get_embedding(text: str) -> List[float]:
    """
    Generate embedding vector for a single text chunk
    """
    if config.USE_OLLAMA:
        try:
            url = f"{config.OLLAMA_HOST}/api/embeddings"
            payload = {"model": config.OLLAMA_EMBED_MODEL, "prompt": text}
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as response:
                res = json.loads(response.read().decode())
                return res["embedding"]
        except Exception as error:
            print(f"Ollama embedding failure: {error}. Falling back to mock...")

    if not config.GEMINI_API_KEY:
        # Generate deterministic mock embedding vector
        import hashlib
        import random
        seed = int(hashlib.md5(text.encode("utf-8")).hexdigest(), 16) % (10 ** 8)
        rng = random.Random(seed)
        vec = [rng.uniform(-1.0, 1.0) for _ in range(768)]
        # Normalize vector to unit length
        norm = sum(x**2 for x in vec) ** 0.5
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text
        )
        return result['embedding']
    except Exception as error:
        print(f"Error generating single embedding: {error}")
        raise RuntimeError(f"Failed to generate embedding: {str(error)}")

def get_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings in batches for efficiency.
    Uses high-performance batch embedding endpoint for Ollama.
    """
    if not texts:
        return []

    if config.USE_OLLAMA:
        return _ollama_embeddings_batch(texts)

    if not config.GEMINI_API_KEY:
        return [get_embedding(t) for t in texts]

    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=texts
        )
        return result['embedding']
    except Exception as error:
        print(f"Batch embedding failed, falling back to sequential: {error}")
        embeddings = []
        for text in texts:
            embeddings.append(get_embedding(text))
        return embeddings


def _ollama_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Generate Ollama embeddings using the high-performance batch `/api/embed` endpoint.
    Falls back to `_ollama_embeddings_concurrent` if the endpoint is not supported (404) or fails.
    """
    total = len(texts)
    print(f"[Ollama] Generating batch embeddings for {total} chunks using /api/embed...")
    start_time = time.time()

    batch_size = 32
    embeddings = []

    try:
        for i in range(0, total, batch_size):
            batch_texts = texts[i:i + batch_size]
            url = f"{config.OLLAMA_HOST}/api/embed"
            payload = {
                "model": config.OLLAMA_EMBED_MODEL,
                "input": batch_texts
            }
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as response:
                res = json.loads(response.read().decode())
                embeddings.extend(res["embeddings"])

            elapsed = time.time() - start_time
            print(f"[Ollama] Batch Progress: {min(i + batch_size, total)}/{total} chunks (elapsed: {elapsed:.1f}s)")

        elapsed = time.time() - start_time
        print(f"[Ollama] Completed {total} embeddings using /api/embed in {elapsed:.1f}s")
        return embeddings

    except urllib.error.HTTPError as error:
        if error.code == 404:
            print(f"[Ollama] /api/embed returned 404 (endpoint not supported). Falling back to concurrent threads...")
        else:
            print(f"[Ollama] Batch embedding HTTP error: {error}. Falling back to concurrent threads...")
        return _ollama_embeddings_concurrent(texts)
    except Exception as error:
        print(f"[Ollama] Batch embedding failure: {error}. Falling back to concurrent threads...")
        return _ollama_embeddings_concurrent(texts)


def _ollama_embeddings_concurrent(texts: List[str]) -> List[List[float]]:
    """
    Generate Ollama embeddings using concurrent threads for massive speedup.
    Processes chunks in parallel batches instead of one-by-one.
    """
    import concurrent.futures

    total = len(texts)
    print(f"[Ollama] Generating embeddings for {total} chunks using concurrent threads...")
    start_time = time.time()

    embeddings = [None] * total
    failed_indices = []

    def embed_single(index: int, text: str):
        try:
            url = f"{config.OLLAMA_HOST}/api/embeddings"
            payload = {"model": config.OLLAMA_EMBED_MODEL, "prompt": text}
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as response:
                res = json.loads(response.read().decode())
                return index, res["embedding"]
        except Exception as error:
            print(f"[Ollama] Failed embedding chunk {index}: {error}")
            return index, None

    # Use 4 concurrent workers — Ollama handles concurrency well
    max_workers = 4
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(embed_single, i, text): i
            for i, text in enumerate(texts)
        }

        completed = 0
        for future in concurrent.futures.as_completed(futures):
            idx, embedding = future.result()
            completed += 1
            if embedding is not None:
                embeddings[idx] = embedding
            else:
                failed_indices.append(idx)

            # Progress logging every 10 chunks
            if completed % 10 == 0 or completed == total:
                elapsed = time.time() - start_time
                rate = completed / elapsed if elapsed > 0 else 0
                print(f"[Ollama] Progress: {completed}/{total} chunks ({rate:.1f} chunks/sec)")

    # Generate mock embeddings for any failures
    if failed_indices:
        print(f"[Ollama] {len(failed_indices)} chunks failed, using mock embeddings as fallback")
        for idx in failed_indices:
            embeddings[idx] = get_embedding(texts[idx])

    elapsed = time.time() - start_time
    print(f"[Ollama] Completed {total} embeddings in {elapsed:.1f}s")
    return embeddings


def stream_chat_response(
    prompt: str, 
    context_text: str, 
    history: Optional[List[Dict[str, str]]] = None,
    tutor_personality: str = "academic"
) -> Generator[str, None, None]:
    """
    Yields chunks of text from Gemini stream or simulated local response or Ollama local stream
    """
    personality_instructions = {
        "socratic": (
            "You are a Socratic Guide. Do NOT give direct answers or solutions immediately. "
            "Instead, ask leading, helpful questions that guide the user to reason through and "
            "discover the answer themselves. Use the provided context to base your questions and "
            "hints. If they are completely stuck, provide a small hint referencing the text."
        ),
        "eli5": (
            "You are an ELI5 Explainer. Explain complex concepts in extremely simple terms using "
            "fun everyday analogies (as if explaining to a 5-year-old child). Break down technical jargon "
            "into simple components based on the provided context."
        ),
        "coach": (
            "You are a practical Exam Prep Coach. Focus on high-yield revision tips, definitions, "
            "and memory shortcuts (like mnemonics). Provide clear, bulleted takeaways and exam warnings "
            "directly related to the provided context."
        ),
        "academic": (
            "You are a helpful AI Study Assistant. Answer the user's question based on the provided "
            "context chunks. Be detailed, scholarly, accurate, and reference source pages."
        )
    }
    
    selected_instruction = personality_instructions.get(tutor_personality, personality_instructions["academic"])
    
    system_instruction = (
        f"{selected_instruction}\n"
        "Base your responses ONLY on the provided context chunks. Be accurate, and reference the source files and "
        "pages if available in the context. If the answer cannot be found in the context, "
        "politely state that you do not have enough information from the documents to answer, "
        "but offer a general response based on your knowledge while clearly indicating it is "
        "not from their documents."
    )
    full_prompt = (
        f"Context from user's study documents:\n---\n{context_text}\n---\n"
        f"Question: {prompt}"
    )

    if config.USE_OLLAMA:
        try:
            url = f"{config.OLLAMA_HOST}/api/chat"
            
            # Construct messages array incorporating history
            messages = [{"role": "system", "content": system_instruction}]
            if history:
                for msg in history:
                    messages.append({"role": msg["role"], "content": msg["content"]})
            messages.append({"role": "user", "content": full_prompt})
            
            payload = {
                "model": config.OLLAMA_MODEL,
                "messages": messages,
                "stream": True,
                "options": {
                    "num_ctx": 3072,
                    "num_predict": 1024,
                    "temperature": 0.2
                }
            }
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=300) as response:
                for line in response:
                    if line:
                        line_decoded = line.decode("utf-8").strip()
                        if not line_decoded:
                            continue
                        try:
                            line_json = json.loads(line_decoded)
                            token = line_json.get("message", {}).get("content", "")
                            if token:
                                yield token
                        except Exception:
                            pass
            return
        except Exception as error:
            print(f"Ollama chat streaming failed: {error}. Falling back to mock...")

    if not config.GEMINI_API_KEY:
        yield "🤖 **Local Offline Mode (GEMINI_API_KEY is not configured)**\n\n"
        yield "I have processed your request locally. Based on the document context, here is what I extracted:\n\n"
        
        # Keyword extraction search fallback
        keywords = [w.lower() for w in prompt.split() if len(w) > 3]
        matching_sentences = []
        
        for line in context_text.split("\n"):
            line_clean = line.strip()
            if not line_clean or line_clean.startswith("[Source"):
                continue
            match_score = sum(1 for kw in keywords if kw in line_clean.lower())
            if match_score > 0:
                matching_sentences.append((match_score, line_clean))
                
        matching_sentences.sort(key=lambda x: x[0], reverse=True)
        
        if matching_sentences:
            yield "### Relevant facts found in your study notes:\n"
            seen = set()
            count = 0
            for score, sentence in matching_sentences:
                sentence_trunc = sentence[:250] + "..." if len(sentence) > 250 else sentence
                if sentence_trunc not in seen:
                    yield f"- *{sentence_trunc}*\n"
                    seen.add(sentence_trunc)
                    count += 1
                    if count >= 3:
                        break
        else:
            yield "No specific sentence match was found for the keywords, but I found some general context in your document:\n\n"
            first_chunks = context_text[:500] + "..." if len(context_text) > 500 else context_text
            yield f"> {first_chunks}\n\n"
            yield f"For advanced general knowledge and accurate semantic question answering, please configure your `GEMINI_API_KEY` in the backend `.env` file!"
        return

    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_instruction
        )
        
        gemini_history = []
        if history:
            for msg in history:
                gemini_history.append({
                    "role": "user" if msg["role"] == "user" else "model",
                    "parts": [msg["content"]]
                })
        
        if gemini_history:
            chat_session = model.start_chat(history=gemini_history)
            response = chat_session.send_message(full_prompt, stream=True)
        else:
            response = model.generate_content(full_prompt, stream=True)
            
        for chunk in response:
            if chunk.text:
                yield chunk.text
    except Exception as error:
        print(f"Streaming completion failed: {error}")
        raise RuntimeError(f"Chat completion failed: {str(error)}")

def generate_structured_json(prompt: str, system_instruction: str) -> Any:
    """
    Generate structured JSON using Gemini JSON Mode or Ollama JSON mode or local fallback template schemas
    """
    if config.USE_OLLAMA:
        try:
            url = f"{config.OLLAMA_HOST}/api/chat"
            payload = {
                "model": config.OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": system_instruction + " Return ONLY a valid JSON string fitting the requested structure."},
                    {"role": "user", "content": prompt}
                ],
                "format": "json",
                "stream": False,
                "options": {
                    "num_ctx": 3072,
                    "num_predict": 2048,
                    "temperature": 0.1
                }
            }
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=300) as response:
                res = json.loads(response.read().decode())
                content_str = res.get("message", {}).get("content", "")
                return json.loads(content_str)
        except Exception as error:
            print(f"Ollama structured generation failed: {error}. Falling back to mock...")

    if not config.GEMINI_API_KEY:
        system_lower = system_instruction.lower()
        prompt_lower = prompt.lower()
        
        # 1. Flashcards Schema
        if "flashcard" in system_lower or "flashcard" in prompt_lower:
            sentences = []
            for line in prompt.split("\n"):
                clean = line.strip()
                if len(clean) > 20 and not clean.startswith("[Source"):
                    sentences.append(clean)
            if not sentences:
                sentences = [
                    "CPU scheduling is the basis of multi-programmed operating systems.",
                    "A process state consists of New, Ready, Running, Waiting, and Terminated.",
                    "Preemptive scheduling can interrupt a running process to allocate CPU to another.",
                    "Context switching is the process of storing and restoring the CPU state of a process.",
                    "First-Come, First-Served (FCFS) scheduling is simple but can cause the convoy effect."
                ]
            
            flashcards = []
            for i, sent in enumerate(sentences[:10]):
                parts = sent.split(" is ")
                if len(parts) > 1:
                    front = f"What is {parts[0].strip()}?"
                    back = parts[1].strip().capitalize()
                else:
                    front = f"Key Concept {i+1}"
                    back = sent
                flashcards.append({"front": front, "back": back})
            return {"flashcards": flashcards}
            
        # 2. Quiz Schema
        elif "quiz" in system_lower or "quiz" in prompt_lower:
            return {
                "title": "Practice Quiz (Offline Mode)",
                "questions": [
                    {
                        "questionText": "Which scheduling algorithm is non-preemptive by default?",
                        "type": "mcq",
                        "options": ["First-Come, First-Served (FCFS)", "Round Robin", "Shortest Remaining Time First", "Priority Preemptive"],
                        "correctAnswer": "First-Come, First-Served (FCFS)",
                        "explanation": "FCFS scheduling is non-preemptive; once a process is allocated the CPU, it keeps it until it terminates or blocks."
                    },
                    {
                        "questionText": "True or False: Preemptive scheduling can interrupt a process currently running on the CPU.",
                        "type": "true-false",
                        "options": ["True", "False"],
                        "correctAnswer": "True",
                        "explanation": "Yes, preemptive scheduling can interrupt processes to run higher-priority or newly ready processes."
                    },
                    {
                        "questionText": "What does CPU stand for?",
                        "type": "short-answer",
                        "options": [],
                        "correctAnswer": "Central Processing Unit",
                        "explanation": "CPU stands for Central Processing Unit, which executes instructions of computer programs."
                    },
                    {
                        "questionText": "Which scheduling algorithm is designed specifically for time-sharing systems?",
                        "type": "mcq",
                        "options": ["FCFS", "Shortest Job First", "Round Robin", "Multilevel Queue"],
                        "correctAnswer": "Round Robin",
                        "explanation": "Round Robin assigns small time slices to each process, making it ideal for interactive time-sharing systems."
                    },
                    {
                        "questionText": "Shortest Job First (SJF) scheduling is optimal because it minimizes average waiting time.",
                        "type": "true-false",
                        "options": ["True", "False"],
                        "correctAnswer": "True",
                        "explanation": "SJF is provably optimal because it yields the minimum average waiting time for a given set of processes."
                    }
                ]
            }
            
        # 3. Notes Summary Schema
        elif "notes" in system_lower or "summarize" in prompt_lower:
            return {
                "title": "Study Notes Summary (Offline)",
                "notesMarkdown": """# Study Notes: Key Concepts Summary

## Chapter Summary
This study guide reviews the core topics highlighted in your uploaded textbook documents. It outlines CPU architectures, multi-programmed scheduling, process lifecycle transitions, state context switches, and performance optimization criteria.

## Key Concepts
* **Preemptive vs. Non-Preemptive Scheduling**: Preemptive algorithms allow the scheduler to interrupt a running process, whereas non-preemptive algorithms run each process to completion or until it relinquishes control.
* **Context Switching**: The mechanical overhead of saving a running thread's state registers into its PCB and loading a ready thread's registers to start execution.
* **Convoy Effect**: A phenomenon in FCFS scheduling where several short processes wait behind one long, CPU-bound process.

## Important Definitions
* **CPU Utilization**: The percentage of time that the CPU is busy executing user or system tasks.
* **Throughput**: The number of complete execution processes completed per time unit.
* **Turnaround Time**: The total elapsed time from process submission to its completion.

## Exam Tips
1. *Practice drawing Gantt charts* for Shortest Job First and Round Robin scheduling, noting when context switches occur.
2. *Remember the formula* for average waiting time: sum of all start times minus arrival times, divided by the number of tasks.
3. *Understand trade-offs* between scheduling algorithms (e.g., Round Robin is good for response time, SJF is good for waiting time)."""
            }
            
        # 4. Planner Schedule Schema
        elif "planner" in system_lower or "study_plan" in prompt_lower:
            return {
                "weeklyGoals": [
                    {"weekNumber": 1, "goal": "Establish baseline understanding of core exam topics."},
                    {"weekNumber": 2, "goal": "Solve practice questions and draft flashcard answers."},
                    {"weekNumber": 3, "goal": "Perform mock quizzes and conduct final revisions."}
                ],
                "schedule": [
                    {"day": "Day 1 (Monday)", "topic": "Introduction and Glossary Review", "tasks": ["Read introductory sections", "Write flashcards for terms"]},
                    {"day": "Day 2 (Tuesday)", "topic": "Deep Dive on Key Concepts", "tasks": ["Summarize notes", "Review exam tips list"]},
                    {"day": "Day 3 (Wednesday)", "topic": "Practice Problems", "tasks": ["Attempt past exam questions", "Compare explanations"]},
                    {"day": "Day 4 (Thursday)", "topic": "Weekly Assessment", "tasks": ["Conduct a simulated quiz", "Identify weak areas"]},
                    {"day": "Day 5 (Friday)", "topic": "Targeted Revision", "tasks": ["Re-study incorrect questions", "Refine summarized points"]},
                    {"day": "Day 6 (Saturday)", "topic": "Comprehensive Revision", "tasks": ["Read entire notes markdown", "Self-test with flashcards"]},
                    {"day": "Day 7 (Sunday)", "topic": "Rest & Final Prep", "tasks": ["Prepare exam day checklist", "Get a good night's rest"]}
                ],
                "revisionPlan": "Revise key formulas and review flashcard definitions. Take a practice quiz under timed conditions."
            }
        
        return {"message": "Mock structured response generated."}

    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_instruction + " Return ONLY a valid JSON string fitting the requested structure."
        )
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        return json.loads(response.text)
    except Exception as error:
        print(f"Structured JSON generation error: {error}")
        raise RuntimeError(f"Structured generator failed: {str(error)}")
