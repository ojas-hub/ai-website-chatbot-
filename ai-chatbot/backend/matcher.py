import re
import math
from typing import List, Dict, Tuple

def tokenize(text: str) -> List[str]:
    # Lowercase, remove non-alphanumeric, and split by whitespace
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', '', text)
    return [word for word in text.split() if len(word) > 1]

class FAQMatcher:
    def __init__(self, faqs: List[Dict[str, str]]):
        """
        faqs is a list of dicts: [{'id': 1, 'question': '...', 'answer': '...'}]
        """
        self.faqs = faqs
        self.corpus_tokens = [tokenize(faq['question']) for faq in faqs]
        self.vocab = set()
        for tokens in self.corpus_tokens:
            self.vocab.update(tokens)
        
        self.vocab = list(self.vocab)
        self.vocab_index = {word: idx for idx, word in enumerate(self.vocab)}
        
        # Calculate IDF
        self.idf = {}
        total_docs = len(faqs)
        for word in self.vocab:
            docs_with_word = sum(1 for tokens in self.corpus_tokens if word in tokens)
            self.idf[word] = math.log((1 + total_docs) / (1 + docs_with_word)) + 1
            
        # Calculate TF-IDF vectors for documents
        self.doc_vectors = []
        for tokens in self.corpus_tokens:
            vector = self._vectorize(tokens)
            self.doc_vectors.append(vector)

    def _vectorize(self, tokens: List[str]) -> Dict[int, float]:
        tf = {}
        for token in tokens:
            if token in self.vocab_index:
                tf[self.vocab_index[token]] = tf.get(self.vocab_index[token], 0) + 1
        
        tfidf = {}
        for idx, count in tf.items():
            word = self.vocab[idx]
            tfidf[idx] = count * self.idf[word]
            
        # Normalize
        length = math.sqrt(sum(v * v for v in tfidf.values()))
        if length > 0:
            for idx in tfidf:
                tfidf[idx] /= length
                
        return tfidf

    def find_best_match(self, query: str, threshold: float = 0.15) -> Tuple[Dict[str, str], float]:
        if not self.faqs:
            return None, 0.0
            
        query_tokens = tokenize(query)
        if not query_tokens:
            return None, 0.0
            
        query_vector = self._vectorize(query_tokens)
        
        best_idx = -1
        best_score = 0.0
        
        for doc_idx, doc_vector in enumerate(self.doc_vectors):
            # Cosine similarity
            score = 0.0
            for idx, val in query_vector.items():
                if idx in doc_vector:
                    score += val * doc_vector[idx]
            
            if score > best_score:
                best_score = score
                best_idx = doc_idx
                
        if best_idx != -1 and best_score >= threshold:
            return self.faqs[best_idx], best_score
            
        return None, best_score
