/**
 * Upload Document JavaScript - Handles form submission and API integration
 */

// Global variables
const preparedFiles = new Map();

document.addEventListener('DOMContentLoaded', function() {
    // Form elements
    const singleDocForm = document.getElementById('uploadSingleForm');
    const compiledDocForm = document.getElementById('uploadCompiledForm');
    
    // Initialize the Read Document button in disabled state
    const readDocBtn = document.querySelector('#singleDocPreview button');
    if (readDocBtn) {
        // Ensure initial state is correct (not filled)
        readDocBtn.classList.remove('text-white', 'bg-primary', 'hover:bg-primary-dark', 'border-transparent');
        readDocBtn.classList.add('text-primary-dark', 'bg-white', 'border-primary');
        readDocBtn.disabled = true;
        
        readDocBtn.addEventListener('click', function(e) {
            // If button is disabled, prevent default action and show message
            if (this.disabled) {
                e.preventDefault();
                alert('Please upload a document first');
                return false;
            }
        });
    }
    
    // Initialize file upload listeners
    initializeFileUpload();
    
    // Form submission handlers
    if (singleDocForm) {
        singleDocForm.addEventListener('submit', handleSingleDocumentSubmit);
        
        // Add input event listeners to update preview in real-time
        const titleInput = singleDocForm.querySelector('input[name="title"]');
        const authorInput = singleDocForm.querySelector('input[name="author"]');
        
        if (titleInput) {
            titleInput.addEventListener('input', function() {
                const previewTitle = document.getElementById('previewTitle');
                if (previewTitle) {
                    previewTitle.textContent = this.value || 'Document Title';
                }
            });
        }
        
        if (authorInput) {
            authorInput.addEventListener('input', function() {
                const previewAuthor = document.getElementById('previewAuthor');
                if (previewAuthor) {
                    previewAuthor.textContent = this.value ? `by ${this.value}` : 'by Unknown Author';
                }
            });
        }
    }
    
    if (compiledDocForm) {
        compiledDocForm.addEventListener('submit', handleCompiledDocumentSubmit);
    }
    
    // Initialize category change listener to update preview in real-time
    const categoryInput = document.getElementById('single-category');
    if (categoryInput) {
        // Update category in preview when selected
        categoryInput.addEventListener('change', function() {
            const previewCategory = document.getElementById('previewCategory');
            if (previewCategory) {
                const selectedOption = this.options[this.selectedIndex];
                previewCategory.textContent = (this.value && selectedOption.text !== 'Choose a category') 
                    ? selectedOption.text 
                    : 'N/A';
            }
            // Also update icon
            updatePreviewIcon(this.value);
        });
        
        // Initialize the preview with current selection
        const previewCategory = document.getElementById('previewCategory');
        if (previewCategory && categoryInput.value) {
            const selectedOption = categoryInput.options[categoryInput.selectedIndex];
            previewCategory.textContent = (categoryInput.value && selectedOption.text !== 'Choose a category') 
                ? selectedOption.text 
                : 'N/A';
        }
        
        // Initial icon update
        updatePreviewIcon(categoryInput.value);
    }
    
    // Set current date for added date
    const previewAddedDate = document.getElementById('previewAddedDate');
    if (previewAddedDate) {
        const today = new Date();
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        previewAddedDate.textContent = today.toLocaleDateString('en-US', dateOptions);
    }
    
    // Initialize publication date preview updates
    const pubMonthInput = document.getElementById('single-pubMonth');
    const pubYearInput = document.getElementById('single-pubYear');
    
    if (pubMonthInput && pubYearInput) {
        const updatePublicationDate = function() {
            const previewPubDate = document.getElementById('previewPubDate');
            if (!previewPubDate) return;
            
            let pubDateText = 'N/A';
            const month = pubMonthInput.options[pubMonthInput.selectedIndex].text;
            const year = pubYearInput.value;
            
            if (month !== 'Select Month' && year) {
                pubDateText = `${month} ${year}`;
            } else if (month !== 'Select Month') {
                pubDateText = month;
            } else if (year) {
                pubDateText = year;
            }
            
            previewPubDate.textContent = pubDateText;
        };
        
        pubMonthInput.addEventListener('change', updatePublicationDate);
        pubYearInput.addEventListener('input', updatePublicationDate);
    }
    
    // Handle compiled document category change
    const compiledCategory = document.getElementById('compiled-category');
    if (compiledCategory) {
        compiledCategory.addEventListener('change', function() {
            updateCompiledPreview();
        });
    }
    
    // File drag and drop handling for single document
    const singleDropZone = document.getElementById('single-dropZone');
    const singleFileInput = document.getElementById('single-file-upload');
    
    if (singleDropZone && singleFileInput) {
        // Highlight drop area when dragging over it
        singleDropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('border-primary');
        });
        
        singleDropZone.addEventListener('dragleave', function() {
            this.classList.remove('border-primary');
        });
        
        // Handle file drop
        singleDropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('border-primary');
            
            if (e.dataTransfer.files.length > 0) {
                singleFileInput.files = e.dataTransfer.files;
                const fileNameDisplay = document.getElementById('single-fileNameDisplay');
                if (fileNameDisplay) {
                    fileNameDisplay.textContent = e.dataTransfer.files[0].name;
                }
                
                // Update the document preview with the file
                updateDocumentPreview(e.dataTransfer.files[0]);
            }
        });
    }
    
    // Call the update functions on page load to set initial icons
    const singleCategoryInitial = categoryInput ? categoryInput.value : '';
    updatePreviewIcon(singleCategoryInitial);
    
    const compiledCategoryInitial = compiledCategory ? compiledCategory.value : '';
    updateCompiledPreview();
});

/**
 * Initialize file upload functionality
 */
function initializeFileUpload() {
    // Handle drag and drop for single document
    const singleDropZone = document.getElementById('single-dropZone');
    const singleFileInput = document.getElementById('single-file-upload');
    
    if (singleDropZone && singleFileInput) {
        // Drag events for single document upload
        singleDropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            singleDropZone.classList.add('drag-over');
        });
        
        singleDropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            singleDropZone.classList.remove('drag-over');
        });
        
        singleDropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            singleDropZone.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length) {
                singleFileInput.files = e.dataTransfer.files;
                
                // Update display
                const fileNameDisplay = document.getElementById('single-fileNameDisplay');
                if (fileNameDisplay) {
                    fileNameDisplay.textContent = e.dataTransfer.files[0].name;
                }
                
                // Update preview button to indicate file is selected
                updateFileSelectedUI('single-file-upload', true, e.dataTransfer.files[0].name);
                
                // Update the document preview with the file
                updateDocumentPreview(e.dataTransfer.files[0]);
            }
        });
        
        // Listen for changes to file input
        singleFileInput.addEventListener('change', function(e) {
            if (this.files.length > 0) {
                // Update preview button to indicate file is selected
                updateFileSelectedUI('single-file-upload', true, this.files[0].name);
                
                // Update the document preview with the file
                updateDocumentPreview(this.files[0]);
            } else {
                // Reset preview if no file is selected
                updateFileSelectedUI('single-file-upload', false);
                updateDocumentPreview(null);
            }
        });
    }
    
    // Initialize file input change handlers for compiled document
    document.querySelectorAll('.file-input').forEach(input => {
        input.addEventListener('change', function(e) {
            const fileNameDisplay = this.closest('.file-input-area').querySelector('.file-name-display');
            if (fileNameDisplay && this.files.length > 0) {
                fileNameDisplay.textContent = this.files[0].name;
            }
        });
    });
}

/**
 * Update the UI to reflect file selection status
 * @param {string} fileInputId The ID of the file input element
 * @param {boolean} isSelected Whether a file is selected
 * @param {string} fileName The name of the selected file (if any)
 */
function updateFileSelectedUI(fileInputId, isSelected, fileName = '') {
    const fileInputContainer = document.getElementById(`${fileInputId}Container`);
    if (!fileInputContainer) return;
    
    const fileUploadButton = fileInputContainer.querySelector('.file-upload-button');
    const fileUploadText = fileInputContainer.querySelector('.file-upload-text');
    const fileUploadIcon = fileInputContainer.querySelector('.file-upload-icon');
    
    if (isSelected) {
        // File is selected - update UI to show active state
        fileInputContainer.classList.add('file-selected');
        fileInputContainer.classList.remove('drag-over');
        
        if (fileUploadButton) {
            fileUploadButton.classList.add('bg-success', 'bg-opacity-10', 'border-success');
            fileUploadButton.classList.remove('bg-gray-50', 'border-dashed');
        }
        
        if (fileUploadText) {
            fileUploadText.textContent = 'File selected';
            fileUploadText.classList.add('text-success');
        }
        
        if (fileUploadIcon) {
            fileUploadIcon.setAttribute('data-lucide', 'check-circle');
            fileUploadIcon.classList.add('text-success');
        }
        
        // Add filename display if it doesn't exist
        let filenameElement = fileInputContainer.querySelector('.selected-filename');
        if (!filenameElement && fileName) {
            filenameElement = document.createElement('div');
            filenameElement.className = 'selected-filename text-sm mt-2 font-medium text-gray-700';
            filenameElement.textContent = fileName;
            fileInputContainer.appendChild(filenameElement);
        } else if (filenameElement && fileName) {
            filenameElement.textContent = fileName;
        }
    } else {
        // No file selected - reset to default state
        fileInputContainer.classList.remove('file-selected', 'drag-over');
        
        if (fileUploadButton) {
            fileUploadButton.classList.remove('bg-success', 'bg-opacity-10', 'border-success');
            fileUploadButton.classList.add('bg-gray-50', 'border-dashed');
        }
        
        if (fileUploadText) {
            fileUploadText.textContent = 'Click to upload or drag and drop';
            fileUploadText.classList.remove('text-success');
        }
        
        if (fileUploadIcon) {
            fileUploadIcon.setAttribute('data-lucide', 'upload-cloud');
            fileUploadIcon.classList.remove('text-success');
        }
        
        // Remove filename display if it exists
        const filenameElement = fileInputContainer.querySelector('.selected-filename');
        if (filenameElement) {
            fileInputContainer.removeChild(filenameElement);
        }
    }
    
    // Re-render Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

/**
 * Handle single document form submission
 * @param {Event} e Form submit event
 */
async function handleSingleDocumentSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const fileInput = form.querySelector('input[type="file"]');
    const categorySelect = form.querySelector('#single-category');
    
    // Check if we have a file input and file
    if (!fileInput || !fileInput.files || !fileInput.files.length) {
        showError('Please select a file to upload');
        return;
    }
    
    try {
        showLoading('Uploading document...');
        
        // Get form data
        const formData = new FormData(form);
        
        // Get the file and add it to form data
        const file = fileInput.files[0];
        formData.append('file', file);
        
        // Get category and document type
        const category = categorySelect?.value || '';
        const documentType = mapCategoryToDocumentType(category);
        
        // Add document type to form data
        formData.append('document_type', documentType);
        
        // Determine storage path
        const storagePath = `storage/${documentType.toLowerCase()}`;
        formData.append('storagePath', storagePath);
        
        // Upload the file
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Failed to upload document');
        }

        const result = await response.json();
        console.log('Upload response:', result);

        // Create document data
        const documentData = {
            title: formData.get('title'),
            abstract: formData.get('abstract') || '',
            publication_date: formData.get('date_published') || new Date().toISOString().split('T')[0],
            document_type: documentType,
            file_path: result.filePath,
            category_id: parseInt(category) || null,
            pages: result.metadata?.pageCount || 0,
            is_public: true
        };

        // Save document to database
        const documentResponse = await fetch('/api/documents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(documentData)
        });

        if (!documentResponse.ok) {
            const errorData = await documentResponse.json();
            throw new Error(errorData.error || 'Failed to save document in database');
        }

        const documentResult = await documentResponse.json();
        console.log('Document saved:', documentResult);

        // Process authors if provided
        const authorInput = form.querySelector('input[name="author"]');
        if (authorInput && authorInput.value.trim()) {
            const authors = authorInput.value.split(';').map(name => name.trim()).filter(name => name);
            if (authors.length > 0) {
                const authorData = {
                    document_id: documentResult.id,
                    authors: authors
                };

                try {
                    const authorResponse = await fetch('/document-authors', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(authorData)
                    });

                    if (!authorResponse.ok) {
                        console.warn('Warning: Authors may not have been saved correctly');
                    }
                } catch (authorError) {
                    console.error('Error saving authors:', authorError);
                }
            }
        }

        // Clear form and file input
        form.reset();
        if (fileInput) {
            fileInput.value = '';
            const fileNameDisplay = document.getElementById(`${fileInput.id.split('-')[0]}-fileNameDisplay`);
            if (fileNameDisplay) {
                fileNameDisplay.textContent = '';
            }
        }

        // Reset any progress indicators
        const progressIndicator = fileInput.closest('.file-input-container')?.querySelector('.progress-indicator');
        const progressBar = progressIndicator?.querySelector('.progress-bar');
        const progressText = progressIndicator?.querySelector('.progress-text');
        const statusMessage = fileInput.closest('.file-input-container')?.querySelector('.status-message');

        if (progressIndicator) progressIndicator.style.display = 'none';
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.textContent = '0%';
        }
        if (progressText) progressText.textContent = '';
        if (statusMessage) {
            statusMessage.textContent = '';
            statusMessage.style.display = 'none';
        }

        // Update UI
        hideLoading();
        showSuccess('Document uploaded and saved successfully', () => {
            form.reset();
            resetFileInputs();
        });
    } catch (error) {
        console.error('Upload error:', error);
        hideLoading();
        showError(error.message || 'Failed to upload document');
    }
}

// Helper function to reset file inputs and their UI
function resetFileInputs() {
    // Reset all file inputs
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.value = '';
        const fileNameDisplay = document.getElementById(`${input.id.split('-')[0]}-fileNameDisplay`);
        if (fileNameDisplay) {
            fileNameDisplay.textContent = '';
        }
        
        // Reset progress indicators
        const progressIndicator = input.closest('.file-input-container')?.querySelector('.progress-indicator');
        const progressBar = progressIndicator?.querySelector('.progress-bar');
        const progressText = progressIndicator?.querySelector('.progress-text');
        const statusMessage = input.closest('.file-input-container')?.querySelector('.status-message');

        if (progressIndicator) progressIndicator.style.display = 'none';
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.textContent = '0%';
        }
        if (progressText) progressText.textContent = '';
        if (statusMessage) {
            statusMessage.textContent = '';
            statusMessage.style.display = 'none';
        }
    });
    
    // Clear prepared files map
    preparedFiles.clear();
}

/**
 * Extract abstract from PDF file returning a Promise
 * @param {File} file - The PDF file to extract from
 * @returns {Promise<string>} - Promise resolving to the extracted abstract
 */
function extractPDFAbstractPromise(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file provided'));
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const typedArray = new Uint8Array(e.target.result);
            
            // Initialize PDF.js
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            
            // Load the PDF document
            const loadingTask = window.pdfjsLib.getDocument({ data: typedArray });
            loadingTask.promise.then(async function(pdf) {
                try {
                    // Search through the first few pages for abstract
                    const maxPagesToSearch = Math.min(5, pdf.numPages);
                    let abstractText = "";
                    let isAbstractSection = false;
                    let abstractStartPage = -1;
                    let abstractEndFound = false;
                    let lastLineWasIncomplete = false;
                    
                    for (let pageNum = 1; pageNum <= maxPagesToSearch && !abstractEndFound; pageNum++) {
                        const page = await pdf.getPage(pageNum);
                        const textContent = await page.getTextContent();
                        
                        // Join text items into lines while preserving their positions
                        const lines = [];
                        let currentLine = [];
                        let lastY = null;
                        
                        // Sort items by vertical position (top to bottom) and horizontal position (left to right)
                        const sortedItems = textContent.items.sort((a, b) => {
                            const yDiff = Math.abs(a.transform[5] - b.transform[5]);
                            if (yDiff > 2) {
                                return b.transform[5] - a.transform[5];
                            }
                            return a.transform[4] - b.transform[4];
                        });
                        
                        // Group items into lines
                        for (const item of sortedItems) {
                            if (lastY === null || Math.abs(item.transform[5] - lastY) <= 2) {
                                currentLine.push(item);
                            } else {
                                if (currentLine.length > 0) {
                                    lines.push(currentLine);
                                }
                                currentLine = [item];
                            }
                            lastY = item.transform[5];
                        }
                        if (currentLine.length > 0) {
                            lines.push(currentLine);
                        }
                        
                        // Convert lines to text while preserving formatting
                        const pageLines = lines.map(line => {
                            const text = line.map(item => item.str).join('');
                            return text.trim();
                        }).filter(line => line.length > 0);
                        
                        const pageText = pageLines.join('\n');
                        
                        // Check if this page contains the abstract
                        if (!isAbstractSection) {
                            const abstractStart = findAbstractStart(pageText);
                            if (abstractStart) {
                                isAbstractSection = true;
                                abstractStartPage = pageNum;
                                abstractText = abstractStart;
                                lastLineWasIncomplete = !abstractStart.endsWith('.') && 
                                                      !abstractStart.endsWith('?') && 
                                                      !abstractStart.endsWith('!');
                            }
                        } else {
                            const endMarkerRegex = new RegExp(
                                "^\\s*(introduction|keywords?:?|index terms:?|background|acknowledg(e|ement|ments)|1\\.?|i\\.?|chapter|section|references)\\b",
                                "im"
                            );
                            const endMatch = pageText.match(endMarkerRegex);

                            if (endMatch) {
                                const markerPosition = pageText.indexOf(endMatch[0]);
                                const abstractPart = pageText.substring(0, markerPosition).trim();

                                if (abstractPart.length > 30) {
                                    abstractText += (lastLineWasIncomplete ? ' ' : '\n') + abstractPart;
                                    abstractEndFound = true;
                                    break;
                                }
                            } else if (pageNum === abstractStartPage) {
                                // Same page as abstract start, content already added
                                continue;
                            } else {
                                // Add content only if it appears to be continuation of the abstract
                                const cleanedText = pageText.replace(/^[\d\s\w]+$|Page \d+|^\d+$/gm, '').trim();
                                if (cleanedText && 
                                    (lastLineWasIncomplete || /^[a-z,;)]/.test(cleanedText) || /[a-z][.?!]$/.test(abstractText)) && 
                                    !cleanedText.toLowerCase().includes('acknowledge') &&
                                    !cleanedText.includes('copyright') &&
                                    !/^\s*\d+\s*$/.test(cleanedText)) {
                                    abstractText += (lastLineWasIncomplete ? ' ' : '\n') + cleanedText;
                                    lastLineWasIncomplete = !cleanedText.endsWith('.') && 
                                                          !cleanedText.endsWith('?') && 
                                                          !cleanedText.endsWith('!');
                                } else {
                                    abstractEndFound = true;
                                }
                            }
                        }
                    }
                    
                    // Clean up the abstract text
                    if (abstractText) {
                        abstractText = cleanAbstractText(abstractText);
                        resolve(abstractText);
                    } else {
                        resolve("No abstract found in the document.");
                    }
                } catch (error) {
                    console.error('Error extracting abstract:', error);
                    reject(error);
                }
            }).catch(function(error) {
                console.error('Error loading PDF:', error);
                reject(error);
            });
        };
        
        reader.onerror = function(error) {
            reject(error);
        };
        
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Handle compiled document form submission
 * @param {Event} e Form submit event
 */
async function handleCompiledDocumentSubmit(e) {
    e.preventDefault();
    
    try {
        // Log all study section data for debugging
        logStudySectionData();
        
        // First validate all research sections
        if (!validateResearchSections()) {
            showError('Please fix the errors in the research sections before submitting.');
            return;
        }
        
        showLoading('Saving compiled document...');
        
        const form = e.target;
        const formData = new FormData(form);
        
        // Debug information - log research sections
        const researchSections = document.querySelectorAll('.research-section');
        console.log(`Found ${researchSections.length} research sections`);
        
        // Count sections with valid files
        let sectionsWithFiles = 0;
        researchSections.forEach((section, index) => {
            // Use the broader selector to find file inputs
            const fileInput = section.querySelector('input[type="file"], .research-file, .hidden-file-input, #file-upload-' + (index+1));
            
            console.log(`Section ${index+1} file input element:`, fileInput);
            
            if (fileInput) {
                console.log(`Section ${index+1} file input name:`, fileInput.name);
                console.log(`Section ${index+1} file input id:`, fileInput.id);
                console.log(`Section ${index+1} has files:`, fileInput.files ? fileInput.files.length : 0);
                
                if (fileInput.files && fileInput.files.length > 0) {
                    sectionsWithFiles++;
                    console.log(`Section ${index+1} has file: ${fileInput.files[0].name}`);
        } else {
                    console.log(`Section ${index+1} has no file or empty files collection`);
                }
            } else {
                console.log(`Section ${index+1} - NO file input found!`);
            }
        });
        console.log(`${sectionsWithFiles} out of ${researchSections.length} sections have files`);
        
        // Validate required fields
        const title = formData.get('title');
        const category = formData.get('category');
        
        if (!category) {
            throw new Error('Category is required');
        }
        
        // Determine category ID based on category name
        let categoryId = 0;
        switch (category.toLowerCase()) {
            case 'confluence':
                categoryId = 3; // ID for Confluence category
                break;
            case 'synergy':
                categoryId = 4; // ID for Synergy category
                break;
            default:
                throw new Error('Invalid category');
        }
        
        // Determine document type based on category
        const documentType = mapCategoryToDocumentType(category);
        
        // Create storage path for compiled document
        // Use only the allowed directories (thesis, dissertation, confluence, synergy, hello)
        let validStorageType = documentType.toLowerCase();
        
        // If documentType would create a directory we've removed, use hello instead
        if (validStorageType !== 'thesis' && 
            validStorageType !== 'dissertation' && 
            validStorageType !== 'confluence' && 
            validStorageType !== 'synergy') {
            validStorageType = 'hello';
        }
        
        const compiledStoragePath = `storage/${validStorageType}/`;
        
        // Process the foreword file if it exists
        const forewordFileInput = document.getElementById('foreword-file-upload');
        let forewordFilePath = null;
        let forewordAbstract = null;
        
        if (forewordFileInput && forewordFileInput.files && forewordFileInput.files.length > 0) {
            const forewordFile = forewordFileInput.files[0];
            
            try {
                // Create a specific path for foreword files with their own subfolder
                const baseStoragePath = `storage/${validStorageType}/`;
                const forewordPath = `${baseStoragePath}forewords/`;
                console.log(`Using foreword storage path: ${forewordPath}`);
                
                // Generate a title for the foreword file
                const volumeNumber = formData.get('volume') || '';
                const forewordTitle = `Foreword ${documentType} ${volumeNumber}`.trim();
            
                const forewordFormData = new FormData();
                forewordFormData.append('file', forewordFile);
                forewordFormData.append('storagePath', forewordPath); // Use the foreword-specific path
                forewordFormData.append('document_type', documentType.toUpperCase());
                forewordFormData.append('category', category);
                forewordFormData.append('is_foreword', 'true'); // Flag to indicate this is a foreword file
                forewordFormData.append('title', forewordTitle); // Add the generated title
                
                // First ensure the forewords directory exists using direct API call
                console.log(`Ensuring foreword directory exists: ${forewordPath}`);
                await fetch('/api/ensure-directory', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        path: forewordPath,
                        force: true,
                        createParents: true 
                    })
                });
            
                // Wait a moment to ensure directory creation completes
                await new Promise(resolve => setTimeout(resolve, 500));
                
                console.log('Attempting to upload foreword file...');
            const forewordFileResponse = await fetch('/api/upload', {
                method: 'POST',
                body: forewordFormData
            });
            
            if (!forewordFileResponse.ok) {
                const errorData = await forewordFileResponse.json();
                console.error('Failed to upload foreword file:', errorData.error || 'Unknown error');
                
                // Show a warning but continue with the submission process
                await Swal.fire({
                    title: 'Foreword Upload Warning',
                    text: 'The foreword file could not be uploaded. The document will be created without a foreword.',
                    icon: 'warning',
                    confirmButtonText: 'Continue Anyway',
                    confirmButtonColor: '#10B981',
                    showCancelButton: true,
                    cancelButtonText: 'Cancel Submission'
                }).then((result) => {
                    if (!result.isConfirmed) {
                        hideLoading();
                        throw new Error('Document submission cancelled by user.');
                    }
                });
                
                // Set forewordFilePath to null so it's properly recorded in the database
                forewordFilePath = null;
                forewordAbstract = null;
            } else {
                const forewordResult = await forewordFileResponse.json();
                forewordFilePath = forewordResult.filePath;
                console.log('Uploaded foreword file to:', forewordFilePath);
                
                // Try to extract abstract from foreword file
                    if (forewordFile.type === 'application/pdf') {
                    try {
                        console.log('Extracting abstract from foreword PDF...');
                            forewordAbstract = await extractPDFAbstractPromise(forewordFile);
                        console.log('Foreword abstract extracted:', forewordAbstract?.substring(0, 100) + '...');
                    } catch (extractionError) {
                        console.error('Error extracting foreword abstract:', extractionError);
                        forewordAbstract = 'Failed to extract abstract from foreword document.';
                    }
                    
                    // Use server-provided metadata as fallback
                    if ((!forewordAbstract || forewordAbstract.trim() === '') && forewordResult.metadata && forewordResult.metadata.abstract) {
                        forewordAbstract = forewordResult.metadata.abstract;
                        console.log('Using server-extracted foreword abstract:', forewordAbstract?.substring(0, 100) + '...');
                    }
                }
                }
            } catch (error) {
                console.error('Error handling foreword file:', error);
                forewordFilePath = null;
                forewordAbstract = null;
            }
        } else {
            console.log('No foreword file found');
        }
        
        // Ensure the directory exists
        await ensureDirectoriesExist(compiledStoragePath);
        // No longer need separate studies subdirectory
        
        // Set department_id if it's a Synergy document
        let departmentId = null;
        if (documentType === 'SYNERGY') {
            const departmentalSelect = document.getElementById('compiled-departmental');
            if (departmentalSelect && departmentalSelect.value) {
                departmentId = parseInt(departmentalSelect.value);
            }
            
            if (!departmentId) {
                showError('Department is required for Synergy documents.');
                hideLoading();
                return;
            }
        }
        
        // Create compiled document data directly in the compiled_documents table
        // instead of going through the documents table first
        const compiledDocData = {
            start_year: formData.get('pub-year-start') ? parseInt(formData.get('pub-year-start')) : null,
            end_year: formData.get('pub-year-end') ? parseInt(formData.get('pub-year-end')) : null,
            volume: formData.get('volume') ? parseInt(formData.get('volume')) : null,
            issue_number: documentType === 'SYNERGY' ? null : (formData.get('issued-no') ? parseInt(formData.get('issued-no')) : null),
            department: departmentId ? getSelectedDepartmentText() : null,
            category: category.toUpperCase(), // Ensure category is uppercase to match enum values
            foreword: forewordFilePath, // Keep the foreword file path
            abstract_foreword: forewordAbstract // Add the foreword abstract
        };
        
        // Call API to create the compiled document entry
        const compiledDocResponse = await fetch('/api/compiled-documents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                compiledDoc: compiledDocData,
                documentIds: [] // Start with empty array, will add children later
            })
        });
        
        if (!compiledDocResponse.ok) {
            const errorData = await compiledDocResponse.json();
            console.warn('Warning: Failed to create compiled document entry:', errorData.error);
            throw new Error(`Failed to create compiled document entry: ${errorData.error || 'Unknown error'}`);
        }
        
        const compiledDocResult = await compiledDocResponse.json();
        console.log('Created compiled document entry with ID:', compiledDocResult.id);
        
        // Store the compiled document ID (this is the ID in the compiled_documents table)
        const compiledDocEntryId = compiledDocResult.id;
        
        // Process each research section (use existing researchSections variable)
        const studyPromises = [];
        const studyDocumentIds = [];
        
        for (let i = 0; i < researchSections.length; i++) {
            const section = researchSections[i];
            
            // Use the broader selector to find file inputs
            const fileInput = section.querySelector('input[type="file"], .research-file, .hidden-file-input, #file-upload-' + (i+1));
            
            // Try multiple selectors for finding the title input
            const titleInput = section.querySelector('.research-title, input[name^="research"][name$="[study_title]"], #study-title-' + (i+1));
            
            console.log(`Section ${i+1} title input:`, titleInput);
            if (titleInput) {
                console.log(`Section ${i+1} title value:`, titleInput.value);
            }
            
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                console.log(`Skipping section ${i+1} - no file uploaded`);
                continue; // Skip sections without files
            }
            
            if (!titleInput) {
                console.log(`ERROR: Title input not found for section ${i+1}`);
                throw new Error(`Title input not found for section ${i+1}. Please refresh the page and try again.`);
            }
            
            if (!titleInput.value || titleInput.value.trim() === '') {
                console.log(`ERROR: Missing title for section ${i+1}`);
                throw new Error(`Each study must have a title (section ${i+1} is missing a title)`);
            }
            
            const file = fileInput.files[0];
            console.log(`Processing study ${i+1} file: ${file.name} (${file.size} bytes) for section with title: ${titleInput.value}`);
            
            // Create study-specific file upload
            const studyFormData = new FormData();
            studyFormData.append('file', file);
            studyFormData.append('storagePath', compiledStoragePath);
            studyFormData.append('document_type', documentType);
            // Add title for file naming
            studyFormData.append('title', titleInput.value);
            
            // Upload the study file
            const studyFileResponse = await fetch('/api/upload', {
                method: 'POST',
                body: studyFormData
            });
            
            if (!studyFileResponse.ok) {
                const errorData = await studyFileResponse.json();
                throw new Error(errorData.error || 'Failed to upload study file');
            }
            
            const fileResult = await studyFileResponse.json();
            
            // Get study category ID (should match the parent document category)
            let studyCategoryId = categoryId;
            
            // Get abstract content from the UI or extracted from PDF
            const abstractContent = section.querySelector('.abstract-content');
            
            // Prioritize extracted abstract from PDF visible in the UI first
            let abstractText = 'No abstract provided';
            
            if (abstractContent && abstractContent.textContent && 
                abstractContent.textContent.trim() !== '' && 
                !abstractContent.textContent.includes('Abstract will be extracted') &&
                !abstractContent.textContent.includes('Extracting abstract')) {
                console.log(`Using extracted abstract from PDF for section ${i+1}`);
                abstractText = abstractContent.textContent.trim();
            }
            
            // Create study document data (will be linked to the compiled document)
            const studyData = {
                title: titleInput.value,
                abstract: abstractText,
                publication_date: new Date().toISOString().split('T')[0],
                document_type: documentType,
                file_path: fileResult.filePath,
                category_id: studyCategoryId,
                pages: 0,
                is_public: true,
                compiled_parent_id: compiledDocEntryId  // Reference to the compiled document ID
            };
            
            // Extract metadata from PDF if available from the server
            if (fileResult.metadata && fileResult.fileType === 'pdf') {
                // Only override abstract if we don't already have one from the UI extraction
                if (abstractText === 'No abstract provided' && fileResult.metadata.abstract) {
                    studyData.abstract = fileResult.metadata.abstract;
                    console.log(`Using metadata abstract from API for section ${i+1}`);
                }
                studyData.pages = fileResult.metadata.pageCount || 0;
            }
            
            console.log(`Saving child document with abstract length: ${studyData.abstract.length} chars`);
            
            // Save study document to database
            const studyPromise = fetch('/api/documents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(studyData)
            }).then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        throw new Error(errorData.error || 'Failed to save study document');
                    });
                }
                return response.json();
            }).then(async result => {
                // Store the study document ID for later linking to the compiled document
                const studyDocId = result.id;
                studyDocumentIds.push(studyDocId);
                
                // Find author input in this research section
                const authorInput = section.querySelector('.authors-input, input[name^="research"][name$="[authors]"], #authors-' + (i+1));
                
                // Process authors if present
                if (authorInput && authorInput.value && authorInput.value.trim() !== '') {
                    try {
                        console.log(`Processing authors for study ${i+1} with ID ${studyDocId}`);
                        
                        // Split authors by semicolon and clean up
                        const authors = authorInput.value.split(';')
                            .map(name => name.trim())
                            .filter(name => name !== '');
                        
                        if (authors.length > 0) {
                            console.log(`Found ${authors.length} authors for study ${i+1}: ${authors.join(', ')}`);
                            
                            // Prepare data for document-authors endpoint
                            const authorData = {
                                document_id: studyDocId,
                                authors: authors
                            };
                            
                            // Send authors to the document-authors endpoint
                            const authorResponse = await fetch('/document-authors', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(authorData)
                            });
                            
                            if (!authorResponse.ok) {
                                const errorText = await authorResponse.text();
                                console.warn(`Warning: Authors may not have been saved correctly for study ${i+1}:`, 
                                    authorResponse.status, errorText);
                            } else {
                                console.log(`Successfully associated ${authors.length} authors with study ${i+1}`);
                            }
                        }
                    } catch (authorError) {
                        console.error(`Error processing authors for study ${i+1}:`, authorError);
                        // Continue with document creation even if author association fails
                    }
                } else {
                    console.log(`No authors specified for study ${i+1}`);
                }
                
                // Add research agenda items if provided
                if (section.querySelector('.research-agenda-input')) {
                    const researchAgendaInput = section.querySelector('.research-agenda-input');
                    
                    // First try getting research agenda from the hidden input that stores collected topics
                    const selectedTopics = section.querySelector('.selected-topics');
                    let researchAgendaItems = [];
                    
                    if (selectedTopics && selectedTopics.querySelectorAll('.selected-topic').length > 0) {
                        // Get from selected topics UI
                        selectedTopics.querySelectorAll('.selected-topic').forEach(topic => {
                            researchAgendaItems.push(topic.textContent.trim().replace('×', '').trim());
                        });
                    } else if (researchAgendaInput.value.trim()) {
                        // Fallback to the input value if no selected topics UI
                        researchAgendaItems = researchAgendaInput.value.split(',').map(item => item.trim()).filter(item => item !== '');
                    }
                    
                    if (researchAgendaItems.length > 0) {
                        // Log what we found for debugging
                        console.log(`Found ${researchAgendaItems.length} research agenda items for section ${i+1}:`, researchAgendaItems);
                        
                        // First add items to research_agenda table (backwards compatibility)
                        const researchAgendaData = {
                            document_id: studyDocId,
                            agenda_items: researchAgendaItems
                        };
                        
                        try {
                            // Send research agenda items to the document-research-agenda endpoint
                            const researchAgendaResponse = await fetch('/document-research-agenda', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(researchAgendaData)
                            });
                            
                            if (!researchAgendaResponse.ok) {
                                console.warn(`Warning: Research agenda items for section ${i+1} may not have been saved correctly`);
                            }
                            
                            // Now also link to the junction table
                            const linkResponse = await fetch('/api/document-research-agenda/link', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(researchAgendaData)
                            });
                            
                            if (!linkResponse.ok) {
                                console.warn(`Warning: Failed to link research agenda items for section ${i+1}`);
                            } else {
                                const linkResult = await linkResponse.json();
                                console.log(`Research agenda linking result for section ${i+1}:`, linkResult);
                            }
                        } catch (agendaError) {
                            console.warn(`Error saving research agenda items for section ${i+1}:`, agendaError);
                        }
                    }
                }
                
                return result;
            });
            
            studyPromises.push(studyPromise);
        }
        
        // Wait for all study documents to be saved
        await Promise.all(studyPromises);
        
        // Link all child documents to the compiled document if we have a valid compiled doc ID
        if (studyDocumentIds.length > 0) {
            try {
                console.debug(`Creating junction table entries for compiled document ${compiledDocEntryId} with ${studyDocumentIds.length} child documents`);
                console.debug('Child document IDs:', studyDocumentIds);
                        
                const linkResponse = await fetch('/api/compiled-documents/add-documents', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        compiledDocumentId: compiledDocEntryId, // Use the ID from compiled_documents table
                        documentIds: studyDocumentIds
                    })
                });
                
                if (!linkResponse.ok) {
                    const errorData = await linkResponse.json();
                    console.warn('Warning: Failed to link some child documents to compilation:', errorData.error);
                    // Continue anyway since the documents were created, but show a more informative message
                    showError(`Compiled document created, but some studies may not appear in the list. Please check the console for details or try refreshing the document list.`);
                } else {
                    const linkResult = await linkResponse.json();
                    console.debug('Junction table entries created:', linkResult);
                    
                    // Check if any failures occurred
                    if (linkResult.results && linkResult.results.some(r => !r.success)) {
                        const failedCount = linkResult.results.filter(r => !r.success).length;
                        console.warn(`${failedCount} out of ${linkResult.results.length} document links failed`);
                        showError(`Compiled document created, but ${failedCount} studies may not appear in the list. Please check the console for details.`);
                    }
                }
            } catch (linkError) {
                console.error('Error linking child documents to compilation:', linkError);
                // Continue anyway since the documents were created
                showError(`Compiled document created, but studies may not appear in the list due to an error: ${linkError.message}`);
            }
        }
        
        // Display upload summary in the console
        console.log("-------------------------------------------");
        console.log("📊 COMPILED DOCUMENT UPLOAD SUMMARY");
        console.log("-------------------------------------------");
        console.log(`✅ Compiled Document ID: ${compiledDocEntryId}`);
        console.log(`📚 Title: ${formData.get('title') || `${category} ${formData.get('volume') || ''}`}`);
        console.log(`📚 Type: ${documentType}`);
        console.log(`📚 Category: ${category}`);
        console.log(`📚 Volume: ${formData.get('volume') || 'N/A'}`);
        
        if (documentType === "SYNERGY") {
            console.log(`📚 Department: ${departmentId ? getSelectedDepartmentText() : 'N/A'}`);
        } else {
            console.log(`📚 Issue: ${formData.get('issued-no') || 'N/A'}`);
        }
        
        console.log(`📚 Years: ${formData.get('pub-year-start') || 'N/A'} - ${formData.get('pub-year-end') || 'N/A'}`);
        console.log(`📚 Child Studies: ${studyDocumentIds.length} (found ${researchSections.length} research sections, ${sectionsWithFiles} with files)`);
        console.log(`📁 Storage Path: ${compiledStoragePath}`);
        console.log(`📄 Foreword Path: ${forewordFilePath || 'No foreword attached'}`);
        console.log("-------------------------------------------");
        
        hideLoading();
        
        // Show success message or warning if files were skipped
        if (sectionsWithFiles === 0) {
            showError('No study files were uploaded. Please add at least one study with a file.');
        } else if (sectionsWithFiles < researchSections.length) {
            showWarning(`Compiled document created with ${studyDocumentIds.length} studies. Note: ${researchSections.length - sectionsWithFiles} sections did not have files attached.`, function() {
                // Reset form
                form.reset();
                
                // Clear research sections
                const researchContainer = document.getElementById('research-sections-container');
                if (researchContainer) {
                    researchContainer.innerHTML = '';
                    addResearchSection(); // Add one empty section
                }
            });
        } else {
            showSuccess('Compiled document created successfully', function() {
                // Reset form
                form.reset();
                
                // Clear research sections
                const researchContainer = document.getElementById('research-sections-container');
                if (researchContainer) {
                    researchContainer.innerHTML = '';
                    addResearchSection(); // Add one empty section
                } else {
                    console.warn('Research sections container not found when trying to clear sections');
                }
            });
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error creating compiled document:', error);
        
        // Provide more detailed error information
        let errorMessage = error.message;
        if (error.stack) {
            console.error('Error stack:', error.stack);
        }
        
        // Check if it's a TypeError with 'null' in the message (common for DOM element issues)
        if (error instanceof TypeError && error.message.includes('null')) {
            errorMessage = 'Form field error: ' + error.message + '. Please make sure all required fields are filled out.';
        }
        
        showError(errorMessage);
    }
}

/**
 * Helper function to ensure directories exist
 * @param {string} path - Directory path
 */
async function ensureDirectoriesExist(path) {
    try {
        // Use a simple fetch to trigger server-side directory creation
        await fetch('/api/ensure-directory', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
            body: JSON.stringify({ path })
        });
    } catch (error) {
        console.warn('Could not ensure directory exists:', path, error);
        // Continue anyway as the upload might still work if directory exists
    }
}

/**
 * Show loading message
 * @param {string} message Loading message to display
 */
function showLoading(message = 'Processing...') {
    // Check if loading overlay already exists
    let loadingOverlay = document.getElementById('loadingOverlay');
    
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.className = 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50';
        loadingOverlay.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-xl max-w-sm mx-auto">
                <div class="flex items-center space-x-4">
                    <svg class="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span id="loadingMessage" class="text-gray-700 text-lg font-medium">${message}</span>
                </div>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    } else {
        document.getElementById('loadingMessage').textContent = message;
        loadingOverlay.style.display = 'flex';
    }
}

/**
 * Hide loading message
 */
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

/**
 * Show error message
 * @param {string} message Error message to display
 */
function showError(message) {
    Swal.fire({
        title: 'Error',
        text: message,
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: '#10B981'
    });
}

/**
 * Show success message
 * @param {string} message Success message to display
 * @param {Function} callback Optional callback function to execute on confirmation
 */
function showSuccess(message, callback) {
    Swal.fire({
        title: 'Success',
        text: message,
        icon: 'success',
        confirmButtonText: 'OK',
        confirmButtonColor: '#10B981'
    }).then(result => {
        if (result.isConfirmed && callback) {
            callback();
        }
    });
}

/**
 * Show warning message
 * @param {string} message Warning message to display
 * @param {Function} callback Optional callback function to execute on confirmation
 */
function showWarning(message, callback) {
    Swal.fire({
        title: 'Warning',
        text: message,
        icon: 'warning',
        confirmButtonText: 'OK',
        confirmButtonColor: '#10B981'
    }).then(result => {
        if (result.isConfirmed && callback) {
            callback();
        }
    });
}

// Function to update preview icon based on document category
function updatePreviewIcon(category) {
    const previewIcon = document.getElementById('preview-category-icon');
    if (!previewIcon) return;
    
    let iconPath = 'icons/category-icons/default_category_icon.png';
    
    // Set the appropriate icon based on the selected category
    switch (category) {
        case 'Thesis':
            iconPath = 'icons/category-icons/thesis.png';
            break;
        case 'Dissertation':
            iconPath = 'icons/category-icons/dissertation.png';
            break;
        case 'Confluence':
            iconPath = 'icons/category-icons/confluence.png';
            break;
        case 'Synergy':
            iconPath = 'icons/category-icons/synergy.png';
            break;
        default:
            iconPath = 'icons/category-icons/default_category_icon.png';
    }
    
    previewIcon.src = iconPath;
    console.log('Updated single document preview icon to:', iconPath);
}

// Function to update compiled document preview
function updateCompiledPreview() {
    // Get form elements
    const titleElement = document.getElementById('preview-main-title');
    const pubYearElement = document.getElementById('preview-pub-year');
    const volumeElement = document.getElementById('preview-volume');
    const categoryElement = document.getElementById('preview-category');
    const categorySelect = document.getElementById('compiled-category');
    const volumeInput = document.getElementById('compiled-volume');
    const departmentalSelect = document.getElementById('compiled-departmental');
    const issuedNoInput = document.getElementById('compiled-issued-no');
    
    if (!titleElement || !categorySelect) return;
    
    // Get the category value
    const category = categorySelect.value;
    
    // Build the title based on category, volume, and department or issue number
    let title = category || 'Compiled Document';
    
    if (volumeInput && volumeInput.value) {
        title += ` Volume ${volumeInput.value}`;
    }
    
    if (category === 'Synergy') {
        // For Synergy, use the department name
        if (departmentalSelect && departmentalSelect.selectedIndex > 0) {
            title += ` - ${getSelectedDepartmentText()}`;
        }
    } else {
        // For other types, use the issue number
        if (issuedNoInput && issuedNoInput.value) {
            title += ` Issue ${issuedNoInput.value}`;
        }
    }
    
    // Update title in preview
    titleElement.textContent = title;
    
    // Update other elements as needed
    if (categoryElement) {
        categoryElement.textContent = category || 'N/A';
    }
    
    if (volumeElement && volumeInput) {
        volumeElement.textContent = volumeInput.value || 'N/A';
    }
    
    // Update icon
    const previewIcon = document.getElementById('compiled-preview-category-icon');
    if (previewIcon) {
    let iconPath = 'icons/category-icons/default_category_icon.png';
    
    // Set the appropriate icon based on the selected category
    switch (category) {
        case 'Confluence':
            iconPath = 'icons/category-icons/confluence.png';
            break;
        case 'Synergy':
            iconPath = 'icons/category-icons/synergy.png';
            break;
        default:
            iconPath = 'icons/category-icons/default_category_icon.png';
    }
    
    previewIcon.src = iconPath;
    console.log('Updated compiled document preview icon to:', iconPath);
    }
}

/**
 * Update the document preview section with the uploaded file
 * @param {File} file The uploaded file
 */
function updateDocumentPreview(file) {
    const previewSection = document.getElementById('singleDocPreview');
    const readDocumentBtn = previewSection ? previewSection.querySelector('button') : null;
    const previewAbstract = document.getElementById('previewAbstract');
    
    if (!previewSection || !readDocumentBtn) return;
    
    if (file) {
        // Show the preview section if it was hidden
        previewSection.classList.add('active');
        
        // Update read document button style to indicate file is ready
        readDocumentBtn.classList.remove('text-primary-dark', 'bg-white');
        readDocumentBtn.classList.add('text-white', 'bg-primary', 'hover:bg-primary-dark', 'border-transparent');
        readDocumentBtn.disabled = false;
        
        // Set onclick handler to open the file in a new tab
        readDocumentBtn.onclick = function(e) {
            const url = URL.createObjectURL(file);
            window.open(url, '_blank');
        };
        
        // Update file name display for better visibility (optional)
        const fileNameDisplay = document.getElementById('single-fileNameDisplay');
        if (fileNameDisplay) {
            fileNameDisplay.innerHTML = `
                <div class="flex items-center mt-2">
                    <i data-lucide="file" class="w-4 h-4 mr-1 text-primary"></i>
                    <span class="text-sm font-medium">${file.name}</span>
                    <span class="ml-2 text-xs text-gray-500">(${(file.size / 1024).toFixed(1)} KB)</span>
                </div>
            `;
            // Re-initialize Lucide icons
            if (window.lucide) {
                lucide.createIcons();
            }
        }
        
        // Extract abstract from PDF if possible
        if (file.type === 'application/pdf' && previewAbstract) {
            previewAbstract.textContent = 'Extracting abstract...';
            
            // Load PDF.js script if not already loaded
            if (!window.pdfjsLib) {
                // Add PDF.js script to document
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
                script.onload = function() {
                    // Once PDF.js is loaded, extract the abstract
                    extractPDFAbstract(file, previewAbstract);
                };
                document.head.appendChild(script);
            } else {
                // PDF.js already loaded, extract the abstract
                extractPDFAbstract(file, previewAbstract);
            }
        } else if (previewAbstract) {
            previewAbstract.textContent = file.type === 'application/pdf' 
                ? 'Loading abstract extraction capabilities...' 
                : 'Abstract extraction is only available for PDF files.';
        }
        
        // Update the category in preview as well
        const categorySelect = document.getElementById('single-category');
        const previewCategory = document.getElementById('previewCategory');
        
        if (categorySelect && previewCategory) {
            const selectedOption = categorySelect.options[categorySelect.selectedIndex];
            previewCategory.textContent = (categorySelect.value && selectedOption.text !== 'Choose a category') 
                ? selectedOption.text 
                : 'N/A';
        }
    } else {
        // Reset read document button style
        readDocumentBtn.classList.remove('text-white', 'bg-primary', 'hover:bg-primary-dark', 'border-transparent');
        readDocumentBtn.classList.add('text-primary-dark', 'bg-white');
        readDocumentBtn.disabled = true;
        readDocumentBtn.onclick = function(e) {
            e.preventDefault();
            Swal.fire({
                icon: 'info',
                title: 'No Document',
                text: 'Please upload a document first',
                confirmButtonColor: '#10B981'
            });
            return false;
        };
        
        // Clear file name display
        const fileNameDisplay = document.getElementById('single-fileNameDisplay');
        if (fileNameDisplay) {
            fileNameDisplay.innerHTML = '';
        }
        
        // Reset abstract
        if (previewAbstract) {
            previewAbstract.textContent = 'Abstract will be extracted when you upload a PDF file.';
        }
    }
}

/**
 * Extract abstract from PDF file using PDF.js
 * @param {File} file - The PDF file to extract from
 * @param {HTMLElement} abstractElement - Element to display the abstract in
 */
function extractPDFAbstract(file, abstractElement) {
    if (!file || !abstractElement) return;
    
    abstractElement.textContent = 'Extracting abstract...';
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const typedArray = new Uint8Array(e.target.result);
        
        // Initialize PDF.js
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        
        // Load the PDF document
        const loadingTask = window.pdfjsLib.getDocument({ data: typedArray });
        loadingTask.promise.then(async function(pdf) {
            try {
                // Search through the first few pages for abstract
                const maxPagesToSearch = Math.min(5, pdf.numPages);
                let abstractText = "";
                let isAbstractSection = false;
                let abstractStartPage = -1;
                let abstractEndFound = false;
                let lastLineWasIncomplete = false;
                
                for (let pageNum = 1; pageNum <= maxPagesToSearch && !abstractEndFound; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    
                    // Join text items into lines while preserving their positions
                    const lines = [];
                    let currentLine = [];
                    let lastY = null;
                    
                    // Sort items by vertical position (top to bottom) and horizontal position (left to right)
                    const sortedItems = textContent.items.sort((a, b) => {
                        const yDiff = Math.abs(a.transform[5] - b.transform[5]);
                        if (yDiff > 2) {
                            return b.transform[5] - a.transform[5];
                        }
                        return a.transform[4] - b.transform[4];
                    });
                    
                    // Group items into lines
                    for (const item of sortedItems) {
                        if (lastY === null || Math.abs(item.transform[5] - lastY) <= 2) {
                            currentLine.push(item);
                        } else {
                            if (currentLine.length > 0) {
                                lines.push(currentLine);
                            }
                            currentLine = [item];
                        }
                        lastY = item.transform[5];
                    }
                    if (currentLine.length > 0) {
                        lines.push(currentLine);
                    }
                    
                    // Convert lines to text while preserving formatting
                    const pageLines = lines.map(line => {
                        const text = line.map(item => item.str).join('');
                        return text.trim();
                    }).filter(line => line.length > 0);
                    
                    const pageText = pageLines.join('\n');
                    
                    // Check if this page contains the abstract
                    if (!isAbstractSection) {
                        const abstractStart = findAbstractStart(pageText);
                        if (abstractStart) {
                            isAbstractSection = true;
                            abstractStartPage = pageNum;
                            abstractText = abstractStart;
                            lastLineWasIncomplete = !abstractStart.endsWith('.') && 
                                                  !abstractStart.endsWith('?') && 
                                                  !abstractStart.endsWith('!');
                        }
                    } else {
                        const endMarkerRegex = new RegExp(
                            "^\\s*(introduction|keywords?:?|index terms:?|background|acknowledg(e|ement|ments)|1\\.?|i\\.?|chapter|section|references)\\b",
                            "im"
                        );
                        const endMatch = pageText.match(endMarkerRegex);

                        if (endMatch) {
                            const markerPosition = pageText.indexOf(endMatch[0]);
                            const abstractPart = pageText.substring(0, markerPosition).trim();

                            if (abstractPart.length > 30) {
                                abstractText += (lastLineWasIncomplete ? ' ' : '\n') + abstractPart;
                                abstractEndFound = true;
                                break;
                            }
                        } else if (pageNum === abstractStartPage) {
                            // Same page as abstract start, content already added
                            continue;
                        } else {
                            // Add content only if it appears to be continuation of the abstract
                            const cleanedText = pageText.replace(/^[\d\s\w]+$|Page \d+|^\d+$/gm, '').trim();
                            if (cleanedText && 
                                (lastLineWasIncomplete || /^[a-z,;)]/.test(cleanedText) || /[a-z][.?!]$/.test(abstractText)) && 
                                !cleanedText.toLowerCase().includes('acknowledge') &&
                                !cleanedText.includes('copyright') &&
                                !/^\s*\d+\s*$/.test(cleanedText)) {
                                abstractText += (lastLineWasIncomplete ? ' ' : '\n') + cleanedText;
                                lastLineWasIncomplete = !cleanedText.endsWith('.') && 
                                                      !cleanedText.endsWith('?') && 
                                                      !cleanedText.endsWith('!');
                            } else {
                                abstractEndFound = true;
                            }
                        }
                    }
                }
                
                // Clean up the abstract text
                if (abstractText) {
                    abstractText = cleanAbstractText(abstractText);
                    
                    // Format as HTML with paragraphs
                    const paragraphs = abstractText
                        .split(/(?<=[.!?])\s+(?=[A-Z])/g) // Split by full-stop + capital start
                        .map(p => p.trim())
                        .filter(p => p.length > 0 && !p.match(/^(keywords?|chapter|section|index terms|acknowledge)/i));
                    
                    const formattedAbstract = `<div class="abstract-text">${paragraphs.map(p => 
                        `<p>${p}</p>`).join('')}</div>`;
                    
                    // Update the abstract element with formatted content
                    abstractElement.innerHTML = formattedAbstract;
                    
                    // Add styling for abstract display
                    addAbstractStyles();
                } else {
                    abstractElement.textContent = "No abstract found in the document.";
                }
            } catch (error) {
                console.error('Error extracting abstract:', error);
                abstractElement.textContent = "Error extracting abstract from PDF.";
            }
        }).catch(function(error) {
            console.error('Error loading PDF:', error);
            abstractElement.textContent = 'Unable to load PDF content. Try a different file.';
        });
    };
    
    reader.onerror = function() {
        abstractElement.textContent = 'Error reading PDF file.';
    };
    
    reader.readAsArrayBuffer(file);
}

/**
 * Function to find the start of the abstract
 * @param {string} text - Text content from PDF
 * @returns {string|null} - The abstract text if found
 */
function findAbstractStart(text) {
    const abstractMarkers = [
        "abstract",
        "abstract:",
        "ABSTRACT",
        "ABSTRACT:",
        "Abstract",
        "Abstract:",
        "A B S T R A C T",
        "A B S T R A C T:"
    ];
    
    const lowerText = text.toLowerCase();
    for (const marker of abstractMarkers) {
        const index = lowerText.indexOf(marker.toLowerCase());
        if (index !== -1) {
            // Get the text after the abstract marker
            const startIndex = index + marker.length;
            let abstractText = text.substring(startIndex).trim();
            
            // Remove any leading colons or spaces
            abstractText = abstractText.replace(/^[:.\s]+/, '').trim();
            
            return abstractText;
        }
    }
    return null;
}

/**
 * Clean extracted abstract text
 * @param {string} text - Raw abstract text
 * @returns {string} - Cleaned abstract text
 */
function cleanAbstractText(text) {
    if (!text) return '';
    
    return text
        .replace(/^ABSTRACT\s*[:.]?\s*/i, '') // Remove "ABSTRACT" header
        .replace(/\n{3,}/g, '\n\n') // Normalize multiple line breaks
        .replace(/\s+/g, ' ') // Normalize spaces
        .replace(/\n\s*\n/g, '\n') // Remove empty lines
        .replace(/acknowledgements?.*$/is, '') // Remove any acknowledgement section
        .replace(/keywords?:.*$/im, '') // Remove keywords section
        .replace(/\s+/g, ' ') // Normalize spaces again after cleanup
        .trim();
}

/**
 * Add CSS styling for abstract display
 */
function addAbstractStyles() {
    // Check if styles are already added
    if (document.getElementById('abstract-styles')) return;
    
    const abstractStyles = `
        .abstract-text {
            text-align: justify;
            hyphens: auto;
            font-weight: normal !important;
        }
        
        .abstract-text p {
            margin: 0 0 1em 0;
            text-indent: 0.5in;
            font-weight: normal !important;
            font-family: inherit;
        }
        
        .abstract-text p:first-child {
            text-indent: 0;
            font-weight: normal !important;
        }
        
        #previewAbstract {
            color: #333;
            font-weight: normal !important;
        }
        
        #previewAbstract * {
            font-weight: normal !important;
        }
    `;
    
    // Add styles to document
    const styleSheet = document.createElement("style");
    styleSheet.id = 'abstract-styles';
    styleSheet.textContent = abstractStyles;
    document.head.appendChild(styleSheet);
}

/**
 * Update category in the preview based on selected category
 */
function updateCategoryInPreview() {
    const categorySelect = document.getElementById('single-category');
    const previewCategory = document.getElementById('previewCategory');
    
    if (!categorySelect || !previewCategory) return;
    
    const selectedOption = categorySelect.options[categorySelect.selectedIndex];
    previewCategory.textContent = (categorySelect.value && selectedOption.text !== 'Choose a category') 
        ? selectedOption.text 
        : 'N/A';
}

// Function to setup file inputs for compiled document studies
function setupStudyFileInputs() {
    document.querySelectorAll('.compiled-study-container').forEach((container, index) => {
        const fileInput = container.querySelector('.study-file-input');
        const fileInputContainer = container.querySelector('.study-file-container');
        const fileId = `study-file-${index + 1}`;
        
        if (fileInput && fileInputContainer) {
            // Set unique ID for this file input
            fileInput.id = fileId;
            fileInputContainer.id = `${fileId}Container`;
            
            // Add drag and drop functionality
            fileInputContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileInputContainer.classList.add('drag-over');
            });
            
            fileInputContainer.addEventListener('dragleave', (e) => {
                e.preventDefault();
                fileInputContainer.classList.remove('drag-over');
            });
            
            fileInputContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.classList.remove('drag-over');
                
                if (e.dataTransfer.files.length > 0) {
                    fileInput.files = e.dataTransfer.files;
                    
                    // Trigger change event
                    const event = new Event('change', { bubbles: true });
                    fileInput.dispatchEvent(event);
                }
            });
            
            // Handle file selection
            fileInput.addEventListener('change', function() {
                if (this.files.length > 0) {
                    const fileName = this.files[0].name;
                    const fileNameDisplay = container.querySelector('.file-name-display');
                    const fileSize = (this.files[0].size / 1024).toFixed(1);
                    
                    if (fileNameDisplay) {
                        fileNameDisplay.innerHTML = `
                            <div class="flex items-center">
                                <i data-lucide="file" class="w-4 h-4 mr-1 text-primary"></i>
                                <span class="font-medium">${fileName}</span>
                                <span class="text-xs text-gray-500 ml-1">(${fileSize} KB)</span>
                            </div>
                        `;
                        
                        // Re-initialize Lucide icons if needed
                        if (window.lucide) {
                            window.lucide.createIcons();
                        }
                    }
                    
                    console.log(`File selected for research section ${fileId}: ${fileName} (${fileSize} KB)`);
                    
                    // Also add a visual indication that the file was selected
                    const uploadContainer = container.querySelector(`#file-upload-container-${fileId}`);
                    if (uploadContainer) {
                        uploadContainer.classList.add('border-primary', 'bg-primary-50');
                        uploadContainer.classList.remove('border-gray-300', 'border-dashed');
                        uploadContainer.innerHTML = `
                            <div class="space-y-1 text-center">
                                <i data-lucide="check-circle" class="mx-auto h-12 w-12 text-success"></i>
                                <div class="text-sm text-success font-medium">File uploaded successfully</div>
                                <div class="text-xs text-gray-500">${fileName} (${fileSize} KB)</div>
                                <button type="button" class="mt-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded" 
                                    onclick="document.getElementById('file-upload-${fileId}').click()">
                                    Replace File
                                </button>
                            </div>
                        `;
                        
                        // Re-initialize Lucide icons
                        if (window.lucide) {
                            window.lucide.createIcons();
                        }
                    }
                }
            });
        }
    });
}

// Initial setup
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...
    
    // Setup single file upload
    const singleFileInput = document.getElementById('single-file-upload');
    if (singleFileInput) {
        const singleFileContainer = document.getElementById('single-file-uploadContainer');
        
        // Add drag and drop functionality
        if (singleFileContainer) {
            singleFileContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                singleFileContainer.classList.add('drag-over');
            });
            
            singleFileContainer.addEventListener('dragleave', (e) => {
                e.preventDefault();
                singleFileContainer.classList.remove('drag-over');
            });
            
            singleFileContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                singleFileContainer.classList.remove('drag-over');
                
                if (e.dataTransfer.files.length > 0) {
                    singleFileInput.files = e.dataTransfer.files;
                    updateFileSelectedUI('single-file-upload', true, e.dataTransfer.files[0].name);
                    // Update document preview
                    updateDocumentPreview(e.dataTransfer.files[0]);
                }
            });
        }
        
        // Handle file selection
        singleFileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                updateFileSelectedUI('single-file-upload', true, this.files[0].name);
                // Update document preview
                updateDocumentPreview(this.files[0]);
            } else {
                updateFileSelectedUI('single-file-upload', false);
                // Reset document preview
                updateDocumentPreview(null);
            }
        });
    }
    
    // Initial setup for compiled document studies
    setupStudyFileInputs();
    
    // Add handler for the "Add Study" button
    const addStudyBtn = document.getElementById('addStudyBtn');
    if (addStudyBtn) {
        addStudyBtn.addEventListener('click', () => {
            // Add a new research section to the form
            addResearchSection();
            
            // Setup file inputs for the new study
            setupStudyFileInputs();
        });
    }
}); 

/**
 * Handles file selection for PDF uploads
 * @param {Event} event - The file input change event
 */
async function handleFileSelection(event) {
    const fileInput = event.target;
    const files = fileInput.files;
    
    console.log('File selection started for input:', fileInput.id);
    console.log('Files selected:', files?.length);
    
    const fileNameDisplay = document.getElementById(`${fileInput.id.split('-')[0]}-fileNameDisplay`);
    const submitButton = fileInput.closest('form').querySelector('button[type="submit"]');
    const progressIndicator = fileInput.closest('.file-input-container').querySelector('.progress-indicator');
    const progressBar = progressIndicator?.querySelector('.progress-bar');
    const progressText = progressIndicator?.querySelector('.progress-text');
    const statusMessage = fileInput.closest('.file-input-container').querySelector('.status-message');
    
    // Clear any existing prepared file for this input
    if (preparedFiles.has(fileInput.id)) {
        console.log('Clearing existing prepared file for:', fileInput.id);
        preparedFiles.delete(fileInput.id);
    }
    
    if (files.length === 0) {
        console.log('No files selected, resetting UI');
        if (fileNameDisplay) {
            fileNameDisplay.textContent = '';
        }
        if (submitButton) {
            submitButton.disabled = true;
        }
        if (progressIndicator) progressIndicator.style.display = 'none';
        if (statusMessage) statusMessage.style.display = 'none';
        return;
    }
    
    const selectedFile = files[0];
    console.log('Selected file details:', {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type
    });
    
    // Show loading state
    console.log('Showing loading state');
    if (fileNameDisplay) {
        fileNameDisplay.textContent = 'Processing file...';
    }
    if (submitButton) {
        submitButton.disabled = true;
    }
    if (progressIndicator) {
        progressIndicator.style.display = 'block';
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.textContent = '0%';
        }
        if (progressText) {
            progressText.textContent = 'Preparing file...';
        }
    }

    try {
        console.log('Creating FormData for file:', selectedFile.name);
        // Create form data for pre-upload
        const formData = new FormData();
        
        // Add file with original name as the field name
        formData.append('file', selectedFile, selectedFile.name);
        
        // Add metadata
        formData.append('generatePreview', 'true');
        formData.append('extractMetadata', 'true');
        formData.append('originalFileName', selectedFile.name);
        formData.append('originalFileSize', selectedFile.size.toString());
        formData.append('originalFileType', selectedFile.type);
        
        // Get form data
        const form = fileInput.closest('form');
        if (form) {
            // Add relevant form fields
            const title = form.querySelector('input[name="title"]')?.value;
            const author = form.querySelector('input[name="author"]')?.value;
            const category = form.querySelector('select[name="category"]')?.value;
            
            if (title) formData.append('title', title);
            if (author) formData.append('author', author);
            if (category) {
                formData.append('category', category);
                formData.append('document_type', mapCategoryToDocumentType(category));
                
                // Handle foreword files specifically
                if (fileInput.id === 'foreword-file-upload') {
                    const documentType = mapCategoryToDocumentType(category);
                    const validStorageType = documentType.toLowerCase();
                    const forewordPath = `storage/${validStorageType}/forewords/`;
                    formData.append('storagePath', forewordPath);
                    formData.append('is_foreword', 'true');
                }
            }
        }
        
        console.log('Sending pre-upload request with data:', {
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            fileType: selectedFile.type,
            category: form?.querySelector('select[name="category"]')?.value
        });
        
        // Send pre-upload request with progress tracking
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && progressBar && progressText) {
                const percentage = (event.loaded / event.total) * 100;
                progressBar.style.width = `${percentage}%`;
                progressBar.textContent = `${Math.round(percentage)}%`;
                progressText.textContent = `Uploading: ${Math.round(percentage)}%`;
            }
        });
        
        const response = await new Promise((resolve, reject) => {
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch (e) {
                        reject(new Error('Invalid server response'));
                    }
    } else {
                    reject(new Error(`Upload failed: ${xhr.statusText}`));
                }
            };
            xhr.onerror = () => reject(new Error('Network error occurred'));
            xhr.open('POST', '/api/pre-upload');
            xhr.send(formData);
        });

        console.log('Pre-upload response:', response);
        
        if (!response.fileId) {
            throw new Error('No fileId received from server');
        }

        // Store the prepared file info with the correct fileId and original file info
        const preparedFileInfo = {
            fileId: response.fileId,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            fileType: selectedFile.type,
            preview: response.preview,
            metadata: response.metadata
        };
        
        console.log('Storing prepared file info:', preparedFileInfo);
        preparedFiles.set(fileInput.id, preparedFileInfo);

        // Update UI for success
        console.log('Updating UI for success');
        if (progressText) {
            progressText.textContent = 'File prepared successfully!';
        }
        if (progressBar) {
            progressBar.style.width = '100%';
            progressBar.textContent = '100%';
        }
                if (fileNameDisplay) {
            fileNameDisplay.textContent = `Ready: ${selectedFile.name}`;
        }
        if (statusMessage) {
            statusMessage.textContent = `"${selectedFile.name}" has been prepared for upload.`;
            statusMessage.style.display = 'block';
            statusMessage.style.color = '#10B981';
        }
        if (submitButton) {
            submitButton.disabled = false;
        }

        // Update document preview if it's a single document upload
        if (fileInput.id === 'single-file-upload') {
            console.log('Updating document preview');
            updateDocumentPreview(selectedFile);
        }

        // For research sections, update the abstract preview if applicable
        if (fileInput.id.startsWith('file-upload-') && selectedFile.type === 'application/pdf') {
            console.log('Updating abstract preview for research section');
            const section = fileInput.closest('.research-section');
            if (section) {
                const abstractContent = section.querySelector('.abstract-content');
                const abstractPreviewSection = section.querySelector('.abstract-preview-section');
                
                if (abstractContent && abstractPreviewSection) {
                    abstractContent.textContent = 'Extracting abstract...';
                    abstractPreviewSection.classList.remove('hidden');
                    
                    if (window.extractPDFAbstractForCompiledDoc) {
                        window.extractPDFAbstractForCompiledDoc(selectedFile, abstractContent);
                    }
                }
            }
        }

    } catch (error) {
        console.error('File preparation error:', error);
        if (progressText) {
            progressText.textContent = `Preparation failed: ${error.message}`;
        }
        if (progressBar) {
            progressBar.style.backgroundColor = '#dc3545';
        }
        if (statusMessage) {
            statusMessage.textContent = 'File preparation failed. Please try again.';
            statusMessage.style.display = 'block';
            statusMessage.style.color = '#dc3545';
        }
        
        // Clear file input
        fileInput.value = '';
        preparedFiles.delete(fileInput.id);
        
        // Show error message
        showError(error.message || 'Failed to prepare file');
    }
}

/**
 * Validate all research sections before submission
 * @returns {boolean} True if all sections are valid, false otherwise
 */
function validateResearchSections() {
    const researchSections = document.querySelectorAll('.research-section');
    let isValid = true;
    
    researchSections.forEach((section, index) => {
        const sectionId = section.getAttribute('data-section-id') || (index + 1);
        
        // Check title input
        const titleInput = section.querySelector('.study-title-input, input[name^="research"][name$="[study_title]"], #study-title-' + sectionId);
        if (!titleInput || !titleInput.value.trim()) {
            console.log(`Validation error: Missing title for research section ${sectionId}`);
            if (titleInput) {
                titleInput.classList.add('border-red-500');
                titleInput.classList.remove('border-gray-300');
            }
            isValid = false;
        } else {
            if (titleInput) {
                titleInput.classList.remove('border-red-500');
                titleInput.classList.add('border-gray-300');
            }
        }
        
        // Check author input
        const authorInput = section.querySelector('.authors-input, input[name^="research"][name$="[authors]"], #authors-' + sectionId);
        if (!authorInput || !authorInput.value.trim()) {
            console.warn(`Warning: No authors specified for research section ${sectionId}`);
            if (authorInput) {
                // Add a visual warning but don't make it a validation error
                authorInput.classList.add('border-yellow-500');
                authorInput.classList.remove('border-gray-300');
            }
            // Don't set isValid = false since authors are helpful but not required
        } else {
            if (authorInput) {
                authorInput.classList.remove('border-yellow-500');
                authorInput.classList.add('border-gray-300');
            }
        }
        
        // Check file input
        const fileUploadInput = section.querySelector('input[type="file"]');
        const fileNameDisplay = section.querySelector('.file-name-display');
        
        if (!fileUploadInput || !fileUploadInput.files || fileUploadInput.files.length === 0) {
            console.log(`Validation error: Missing file for research section ${sectionId}`);
            const fileUploadContainer = section.querySelector(`#file-upload-container-${sectionId}`);
            if (fileUploadContainer) {
                fileUploadContainer.classList.add('border-red-500');
                fileUploadContainer.classList.remove('border-gray-300', 'border-dashed');
            }
            isValid = false;
        } else {
            const fileUploadContainer = section.querySelector(`#file-upload-container-${sectionId}`);
            if (fileUploadContainer) {
                fileUploadContainer.classList.remove('border-red-500');
                fileUploadContainer.classList.add('border-gray-300', 'border-dashed');
            }
        }
    });
    
    if (!isValid) {
        console.log('Validation failed for research sections');
    }
    
    return isValid;
}

/**
 * Log all data in study sections for debugging
 */
function logStudySectionData() {
    console.log('--- STUDY SECTION DATA DUMP ---');
    const sections = document.querySelectorAll('.research-section');
    
    sections.forEach((section, index) => {
        const sectionId = index + 1;
        console.log(`\nSection ${sectionId} data:`);
        
        // Title field
        const titleInput = section.querySelector('.research-title, input[name^="research"][name$="[study_title]"], #study-title-' + sectionId);
        console.log(`- Title element:`, titleInput);
        console.log(`- Title value:`, titleInput ? titleInput.value : 'NOT FOUND');
        
        // Abstract field
        const abstractInput = section.querySelector('.research-abstract, textarea[name^="research"][name$="[abstract]"], #research-abstract-' + sectionId);
        console.log(`- Abstract element:`, abstractInput);
        console.log(`- Abstract value:`, abstractInput ? abstractInput.value : 'NOT FOUND');
        
        // File input
        const fileInput = section.querySelector('input[type="file"], .research-file, .hidden-file-input, #file-upload-' + sectionId);
        console.log(`- File input element:`, fileInput);
        console.log(`- File selected:`, fileInput && fileInput.files && fileInput.files.length > 0 ? 
            `${fileInput.files[0].name} (${fileInput.files[0].size} bytes)` : 'NO FILE');
    });
    console.log('--- END DATA DUMP ---');
}

/**
 * Extract just the department code from the selected department text
 * Example: "Computer Science (CS)" -> "CS"
 * @returns {string} The department code or an empty string if not found
 */
function getDepartmentCode() {
    const departmentText = getSelectedDepartmentText();
    
    // Try to extract code in parentheses, e.g., "Department Name (CODE)"
    const codeMatch = departmentText.match(/\(([^)]+)\)/);
    
    if (codeMatch && codeMatch[1]) {
        return codeMatch[1].trim();
    }
    
    // If no parentheses, return the department text or a default
    return departmentText || '';
}

/**
 * Maps the selected category value to a valid document_type enum value
 * @param {string} category - The selected category value
 * @returns {string} - A valid document_type value
 */
function mapCategoryToDocumentType(category) {
    if (!category) return 'HELLO';
    
    // Normalize the category to uppercase for comparison
    const normalizedCategory = category.toUpperCase();
    
    // Direct mapping of categories to document types
    const mapping = {
        'THESIS': 'THESIS',
        'DISSERTATION': 'DISSERTATION',
        'CONFLUENCE': 'CONFLUENCE',
        'SYNERGY': 'SYNERGY'
    };
    
    return mapping[normalizedCategory] || 'HELLO';
}

// Function to set up file upload UI components
function setupFileUpload(fileInputId, fileLabelId, fileNameDisplayId, progressIndicatorId, progressBarId, progressTextId, statusMessageId) {
    const fileInput = document.getElementById(fileInputId);
    const fileLabel = document.getElementById(fileLabelId);
    const fileNameDisplay = fileNameDisplayId ? document.getElementById(fileNameDisplayId) : 
                           fileInput.closest('.file-input-container').querySelector('.file-name-display');
    const progressIndicator = document.getElementById(progressIndicatorId);
    const progressBar = document.getElementById(progressBarId);
    const progressText = document.getElementById(progressTextId);
    const statusMessage = document.getElementById(statusMessageId);
    
    // Handle file selection using the pre-upload handler
    fileInput.addEventListener('change', handleFileSelection);

    // Handle drag and drop
    const dropZone = fileInput.closest('.file-input-container');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                // Trigger the change event to start pre-upload
                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
            }
        });
    }
}