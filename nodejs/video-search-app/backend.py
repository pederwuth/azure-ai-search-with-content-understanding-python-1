from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from langchain.schema import Document
from langchain_openai import AzureChatOpenAI
from langchain_openai import AzureOpenAIEmbeddings
from langchain.schema import StrOutputParser
from langchain.schema.runnable import RunnablePassthrough
from langchain_community.vectorstores import AzureSearch
from langchain_core.prompts import ChatPromptTemplate
import os
import json

app = Flask(__name__)
CORS(app)

prompt_str = """You are an assistant for finding relevant video segments given a question. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise. If you find a relevant video segment, summarize the details of the segment. Include the startTimeMs and endTimeMs. At the end of your response, output the url of the segment, followed by a space, and followed by the starting time of the segment in integer seconds, don't add parenthesis or any other character before or after the starting time or the url.
Question: {question} 
Context: {context} 
Answer:"""

AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME = ""
AZURE_OPENAI_EMBEDDINGS_API_VERSION = ""
AZURE_OPENAI_ENDPOINT = ""
AZURE_OPENAI_API_KEY = ""
AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME = ""
AZURE_OPENAI_COMPLETIONS_API_VERSION = ""
AZURE_SEARCH_ENDPOINT = ""
AZURE_SEARCH_ADMIN_KEY = ""
INDEX_NAME = ""
AZURE_AI_SERVICES_ENDPOINT = ""
AZURE_AI_SERVICES_API_VERSION = ""
AZURE_AI_SERVICES_API_KEY = ""

# Default JSON configuration
DEFAULT_JSON_CONFIG = {
    "analyzerId": "video_cu_analyzer",
    "name": "Video Content Understanding",
    "description": "Generating content understanding from video.",
    "scenario": "videoShot",
    "config": {
        "returnDetails": True,
        "locales": [
            "en-US",
            "es-ES",
            "es-MX",
            "fr-FR",
            "hi-IN",
            "it-IT",
            "ja-JP",
            "ko-KR",
            "pt-BR",
            "zh-CN"
        ],
        "enableFace": False
    },
    "fieldSchema": {
        "name": "Content Understanding",
        "descriptions": "Generate content understanding from video.",
        "fields": {
            "segmentDescription": {
                "type": "string",
                "description": "Detailed summary of the video segment, focusing on people, places, and actions taking place."
            }
        }
    }
}

# Utility functions for JSON processing
def convert_values_to_strings(json_obj):
    return [str(value) for value in json_obj]

def remove_markdown(json_obj):
    for segment in json_obj:
        if 'markdown' in segment:
            del segment['markdown']
    return json_obj

def process_cu_scene_description(scene_description, video_url):
    audio_visual_segments = scene_description["result"]["contents"]
    for segment in audio_visual_segments:
        segment["url"] = video_url
    audio_visual_splits = [json.dumps(v) for v in audio_visual_segments]
    docs = [Document(page_content=v) for v in audio_visual_splits]
    return docs

def embed_and_index_chunks(docs):
    aoai_embeddings = AzureOpenAIEmbeddings(
        azure_deployment=AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME,
        openai_api_version=AZURE_OPENAI_EMBEDDINGS_API_VERSION,  # e.g., "2023-12-01-preview"
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
    )

    vector_store: AzureSearch = AzureSearch(
        azure_search_endpoint=AZURE_SEARCH_ENDPOINT,
        azure_search_key=AZURE_SEARCH_ADMIN_KEY,
        index_name=INDEX_NAME,
        embedding_function=aoai_embeddings.embed_query,
    )
    vector_store.add_documents(documents=docs)

# RAG
def setup_rag_chain(vector_store):
    retriever = vector_store.as_retriever(search_type="similarity", k=3)

    prompt = ChatPromptTemplate.from_template(prompt_str)
    llm = AzureChatOpenAI(
        openai_api_version=AZURE_OPENAI_COMPLETIONS_API_VERSION,  # e.g., "2023-12-01-preview"
        azure_deployment=AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME,
        temperature=0.7,
    )

    def format_docs(docs):
        return "\n\n".join(doc.page_content for doc in docs)

    rag_chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    return rag_chain

def conversational_search(query):
    aoai_embeddings = AzureOpenAIEmbeddings(
        azure_deployment=AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME,
        openai_api_version=AZURE_OPENAI_EMBEDDINGS_API_VERSION,  # e.g., "2023-12-01-preview"
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
    )

    vector_store: AzureSearch = AzureSearch(
        azure_search_endpoint=AZURE_SEARCH_ENDPOINT,
        azure_search_key=AZURE_SEARCH_ADMIN_KEY,
        index_name=INDEX_NAME,
        embedding_function=aoai_embeddings.embed_query,
    )

    rag_chain = setup_rag_chain(vector_store)
    output = rag_chain.invoke(query)
    print(output)
    return output

def similarity_search(query):
    aoai_embeddings = AzureOpenAIEmbeddings(
        azure_deployment=AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME,
        openai_api_version=AZURE_OPENAI_EMBEDDINGS_API_VERSION,  # e.g., "2023-12-01-preview"
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
    )

    vector_store: AzureSearch = AzureSearch(
        azure_search_endpoint=AZURE_SEARCH_ENDPOINT,
        azure_search_key=AZURE_SEARCH_ADMIN_KEY,
        index_name=INDEX_NAME,
        embedding_function=aoai_embeddings.embed_query,
    )

    docs = vector_store.similarity_search(
        query=query,
        k=3,
        search_type="similarity",
    )
    return docs

def hybrid_search(query):
    aoai_embeddings = AzureOpenAIEmbeddings(
        azure_deployment=AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME,
        openai_api_version=AZURE_OPENAI_EMBEDDINGS_API_VERSION,  # e.g., "2023-12-01-preview"
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
    )

    vector_store: AzureSearch = AzureSearch(
        azure_search_endpoint=AZURE_SEARCH_ENDPOINT,
        azure_search_key=AZURE_SEARCH_ADMIN_KEY,
        index_name=INDEX_NAME,
        embedding_function=aoai_embeddings.embed_query,
    )

    # Use hybrid search which combines semantic and keyword search
    docs = vector_store.hybrid_search(query=query, k=5)
    return docs

# Process video with Azure Content Understanding
def process_video_with_cu(video_url, analyzer_schema):
    try:
        # Initialize the Azure Content Understanding client
        from content_understanding_client import AzureContentUnderstandingClient
        import uuid
        
        # Process the video URL with the analyzer
        analyzer_id = analyzer_schema.get("analyzerId") + "_" + str(uuid.uuid4())
        print(f"Processing video URL: {video_url} with analyzer ID: {analyzer_id}")
        
        cu_client = AzureContentUnderstandingClient(
            endpoint=AZURE_AI_SERVICES_ENDPOINT,
            api_version=AZURE_AI_SERVICES_API_VERSION,
            subscription_key=AZURE_AI_SERVICES_API_KEY
        )
        response = cu_client.begin_create_analyzer(analyzer_id, analyzer_schema=analyzer_schema)
        result = cu_client.poll_result(response)

        response = cu_client.begin_analyze(analyzer_id, file_location=video_url)
        video_cu_result = cu_client.poll_result(response, timeout_seconds=36000)

        cu_client.delete_analyzer(analyzer_id)
        
        # For now, just return success
        return True, "Video URL processed successfully", video_cu_result
        
    except Exception as e:
        print(f"Error processing video with Azure Content Understanding: {str(e)}")
        return False, f"Failed to process video: {str(e)}", None

# New endpoint for configuration settings
@app.route('/config', methods=['POST'])
def update_config():
    try:
        # No need to process any Azure configuration from the frontend
        # Just return success as the configuration is now read from .env file
        print("Configuration endpoint called - settings are now read from .env file")
        
        return jsonify({'message': 'Configuration settings are now read from environment variables'}), 200
    
    except Exception as e:
        print(f"Error in config endpoint: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Updated search endpoint to support both similarity and hybrid search
@app.route('/search', methods=['POST'])
def search():
    data = request.get_json()
    query = data.get('query', '')
    search_type = data.get('searchType', 'similarity')  # Default to similarity if not specified
    
    print(f"Search query: {query}, Search type: {search_type}")
    
    if not query:
        return jsonify({'error': 'No query provided'}), 400
    
    try:
        # Perform search based on the selected search type
        response = []
        
        if search_type == 'hybrid':
            results = hybrid_search(query)
        else:  # Default to similarity search
            results = similarity_search(query)
            
        if results:
            for res in results:
                page_content = json.loads(res.page_content)
                res_obj = {
                    "startTimeMs": page_content["startTimeMs"],
                    "endTimeMs": page_content["endTimeMs"],
                    "fields": page_content["fields"],
                    "videoUrl": page_content.get("url", "")  # Include the video URL in the response
                }
                response.append(res_obj)
        print(f"Found {len(response)} results")
        
        return jsonify({
            'results': response,
            'searchType': search_type
        }), 200
    except Exception as e:
        print(f"Search error: {str(e)}")
        return jsonify({'error': f'Search failed: {str(e)}'}), 500

conversations = []
# Endpoint for chat
@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_message = data.get('message', '')

    reply = conversational_search(user_message)
    ai_reply = f"{reply}"  # Replace with real AI integration.

    # Save this message pair in memory.
    conversations.append({
        'user': user_message,
        'ai': ai_reply
    })

    return jsonify({
        'reply': ai_reply
    })

# Updated endpoint for uploading JSON files and video URL
@app.route('/upload', methods=['POST'])
def upload_json():
    if 'jsonFile' not in request.files:
        return jsonify({'error': 'No JSON file provided'}), 400
    
    file = request.files['jsonFile']
    video_url = request.form.get('videoUrl', '')
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if not video_url:
        return jsonify({'error': 'No video URL provided'}), 400
    
    # Check if settings are configured
    if not all([
        AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME,
        AZURE_OPENAI_EMBEDDINGS_API_VERSION,
        AZURE_OPENAI_ENDPOINT,
        AZURE_OPENAI_API_KEY,
        AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME,
        AZURE_OPENAI_COMPLETIONS_API_VERSION,
        AZURE_SEARCH_ENDPOINT,
        AZURE_SEARCH_ADMIN_KEY,
        INDEX_NAME,
        AZURE_AI_SERVICES_ENDPOINT,
        AZURE_AI_SERVICES_API_VERSION,
        AZURE_AI_SERVICES_API_KEY
    ]):
        return jsonify({'error': 'Configuration settings must be set before uploading files'}), 400
    
    try:
        # Process JSON file
        json_data = json.load(file)
        print(json.dumps(json_data, indent=2))  # Print the received JSON object
        
        # Validate the JSON structure
        required_fields = ["analyzerId", "name", "description", "scenario", "config", "fieldSchema"]
        missing_fields = [field for field in required_fields if field not in json_data]
        
        if missing_fields:
            return jsonify({
                'error': f'Invalid JSON format. Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Process the video with Azure Content Understanding
        success, message, video_cu_result = process_video_with_cu(video_url, json_data)
        
        if not success:
            return jsonify({'error': message}), 500
        
        # Process the JSON data if needed
        # If this is a scene description, process it and index it
        try:
            docs = process_cu_scene_description(video_cu_result, video_url)
            embed_and_index_chunks(docs)
            print("Successfully indexed video content")
            return jsonify({
                "message": "Video indexed with custom analyzer successfully", 
                "data": json_data,
                "videoUrl": video_url
            }), 200
        except Exception as e:
            print(f"Error processing scene description: {str(e)}")
            # If it's not a scene description or there's an error, just return the JSON
            return jsonify({
                "message": "JSON configuration and video URL received", 
                "data": json_data,
                "videoUrl": video_url
            }), 200
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON format'}), 400
    except Exception as e:
        print(f"Error processing upload: {str(e)}")
        return jsonify({'error': f'Failed to process upload: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)
