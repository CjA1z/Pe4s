/**
 * Handles chunked file upload with progress tracking
 */

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

class ChunkedUploader {
    constructor(file, options = {}) {
        this.file = file;
        this.chunkSize = options.chunkSize || CHUNK_SIZE;
        this.onProgress = options.onProgress || (() => {});
        this.onComplete = options.onComplete || (() => {});
        this.onError = options.onError || (() => {});
        this.uploadEndpoint = options.uploadEndpoint || '/api/upload';
        this.aborted = false;
        this.uploadedBytes = 0;
        this.totalBytes = file.size;
        this.documentType = options.documentType || 'HELLO';
        this.category = options.category || '';
        this.fileId = null;
    }

    async start() {
        try {
            const chunks = this.createChunks();
            await this.uploadChunks(chunks);
            
            if (!this.aborted) {
                this.onComplete();
            } else {
                // If aborted, clean up the temporary files
                await this.cleanup();
            }
        } catch (error) {
            console.error('Upload error:', error);
            // Clean up on error too
            await this.cleanup();
            this.onError(error);
        }
    }

    async cleanup() {
        if (this.fileId) {
            try {
                // Call the cleanup endpoint
                await fetch('/api/upload/cleanup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fileId: this.fileId
                    })
                });
            } catch (error) {
                console.error('Cleanup error:', error);
            }
        }
    }

    createChunks() {
        const chunks = [];
        let start = 0;
        
        while (start < this.file.size) {
            const end = Math.min(start + this.chunkSize, this.file.size);
            chunks.push(this.file.slice(start, end));
            start = end;
        }
        
        return chunks;
    }

    async uploadChunks(chunks) {
        for (let i = 0; i < chunks.length; i++) {
            if (this.aborted) {
                await this.cleanup();
                break;
            }

            const chunk = chunks[i];
            const formData = new FormData();
            formData.append('file', chunk, this.file.name);
            formData.append('chunkIndex', i.toString());
            formData.append('totalChunks', chunks.length.toString());
            formData.append('fileName', this.file.name);
            formData.append('document_type', this.documentType);
            formData.append('category', this.category);
            
            try {
                const xhr = new XMLHttpRequest();
                await new Promise((resolve, reject) => {
                    xhr.upload.addEventListener('progress', (event) => {
                        if (event.lengthComputable) {
                            const chunkProgress = event.loaded;
                            this.uploadedBytes = (i * this.chunkSize) + chunkProgress;
                            const progress = (this.uploadedBytes / this.totalBytes) * 100;
                            this.onProgress(Math.min(progress, 100));
                        }
                    });

                    xhr.addEventListener('load', () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const response = JSON.parse(xhr.responseText);
                                if (response.error) {
                                    reject(new Error(response.error));
                                } else {
                                    // Store the fileId from the first chunk response
                                    if (i === 0 && response.fileId) {
                                        this.fileId = response.fileId;
                                    }
                                    resolve(response);
                                }
                            } catch (e) {
                                reject(new Error('Invalid server response'));
                            }
                        } else {
                            try {
                                const response = JSON.parse(xhr.responseText);
                                reject(new Error(response.error || `Upload failed: ${xhr.statusText}`));
                            } catch (e) {
                                reject(new Error(`Upload failed: ${xhr.statusText}`));
                            }
                        }
                    });

                    xhr.addEventListener('error', () => {
                        reject(new Error('Network error occurred'));
                    });

                    xhr.addEventListener('abort', () => {
                        reject(new Error('Upload aborted'));
                    });

                    xhr.open('POST', this.uploadEndpoint);
                    xhr.send(formData);
                });

                this.uploadedBytes = (i + 1) * chunk.size;
                const progress = (this.uploadedBytes / this.totalBytes) * 100;
                this.onProgress(Math.min(progress, 100));

            } catch (error) {
                console.error('Chunk upload error:', error);
                throw error;
            }
        }
    }

    abort() {
        this.aborted = true;
    }
}

// Function to initialize chunked upload with progress tracking
function initChunkedUpload(fileInput, progressBar, progressText) {
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Get the category and map it to document type
        const categorySelect = document.getElementById('single-category');
        if (!categorySelect || !categorySelect.value) {
            progressText.textContent = 'Please select a category first';
            return;
        }

        const category = categorySelect.value;
        const documentType = mapCategoryToDocumentType(category);

        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        progressText.textContent = 'Starting upload...';
        progressBar.parentElement.style.display = 'block';
        progressBar.style.backgroundColor = '#10B981'; // Reset to success color

        const uploader = new ChunkedUploader(file, {
            documentType: documentType,
            category: category,
            onProgress: (progress) => {
                const percentage = Math.round(progress);
                progressBar.style.width = `${percentage}%`;
                progressBar.textContent = `${percentage}%`;
                progressText.textContent = `Uploading: ${percentage}%`;
            },
            onComplete: () => {
                progressText.textContent = 'Upload complete!';
                progressBar.style.width = '100%';
                progressBar.textContent = '100%';
                
                // Trigger the form submission or next steps
                const form = fileInput.closest('form');
                if (form) {
                    const event = new CustomEvent('uploadComplete', {
                        detail: { fileName: file.name }
                    });
                    form.dispatchEvent(event);
                }
            },
            onError: (error) => {
                console.error('Upload error:', error);
                progressText.textContent = `Upload failed: ${error.message}`;
                progressBar.style.backgroundColor = '#dc3545';
            }
        });

        try {
            await uploader.start();
        } catch (error) {
            console.error('Upload failed:', error);
            progressText.textContent = `Upload failed: ${error.message}`;
            progressBar.style.backgroundColor = '#dc3545';
        }
    });
}

// Helper function to map category to document type
function mapCategoryToDocumentType(category) {
    switch(category) {
        case 'Thesis':
            return 'THESIS';
        case 'Dissertation':
            return 'DISSERTATION';
        case 'Confluence':
            return 'CONFLUENCE';
        case 'Synergy':
            return 'SYNERGY';
        default:
            return 'HELLO';
    }
}

// Export the functions and class
window.ChunkedUploader = ChunkedUploader;
window.initChunkedUpload = initChunkedUpload; 