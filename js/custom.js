console.log('Custom.js loaded!');

Reveal.on('ready', function() {
    console.log('Reveal ready event fired!');
    
    // Wait for math rendering to complete before sizing
    // Use requestAnimationFrame to wait for next paint cycle after ready
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            centerMathBlocks();
            adjustFontSizeForCurrentSlide();
            adjustFontSizeForAllSlides();
        });
    });
    
    // Numerazione slide
    const sections = document.querySelectorAll('.reveal .slides section');
    sections.forEach((section, index) => {
        section.setAttribute('data-slide-number', index + 1);
    });

    // When reveal.js finishes building the print layout, ensure defaults and rerun adjustments
    Reveal.on('pdf-ready', function() {
        // Ensure cloned slides inside .pdf-page have a default data-state of "normal"
        const pdfSections = document.querySelectorAll('.pdf-page > section');
        pdfSections.forEach((section) => {
            const stateAttr = section.getAttribute('data-state');
            if (!stateAttr || stateAttr.trim() === '') {
                section.setAttribute('data-state', 'normal');
            }
        });

        // Re-run adjustments after the print layout has been applied
        setTimeout(function() {
            centerMathBlocks();
            adjustFontSizeForAllSlides();
        }, 50);
    });

    // Ensure slides without data-state default to "normal"
    sections.forEach((section) => {
        const stateAttr = section.getAttribute('data-state');
        if (!stateAttr || stateAttr.trim() === '') {
            section.setAttribute('data-state', 'normal');
        }
    });

    // Sync body class for default slides (so background works for default normal slides)
    syncBodyClassWithCurrentSlide();
});

Reveal.on('slidechanged', function() {
    // Re-adjust on slide change (in case of dynamic content)
    // Only measure the visible slide: hidden slides can report different heights
    // and overwrite classes with incorrect values.
    adjustFontSizeForCurrentSlide();
    
    // Sync body class for default slides on navigation
    syncBodyClassWithCurrentSlide();
    // Center math blocks on slide change
    setTimeout(centerMathBlocks, 50);
});

function adjustFontSizeForCurrentSlide() {
    const current = Reveal.getCurrentSlide();
    if (current) {
        adjustFontSizeForSection(current);
    }
    // Print-pdf clones must be processed as a whole document
    if (document.body.classList.contains('print-pdf')) {
        adjustFontSizeForAllSlides();
    }
}

function adjustFontSizeForSection(section) {
    const contentDiv = section.querySelector('.content-center');
    if (!contentDiv) return;

    // If the slide contains images that are not yet loaded, measurements will be wrong.
    const imgs = Array.from(contentDiv.querySelectorAll('img'));
    const pendingImgs = imgs.filter(img => !img.complete);
    if (pendingImgs.length > 0) {
        if (!section.__fontResizeWaitingForImages) {
            section.__fontResizeWaitingForImages = true;
            const onDone = () => {
                section.__fontResizeWaitingForImages = false;
                adjustFontSizeForSection(section);
            };
            pendingImgs.forEach(img => {
                img.addEventListener('load', onDone, { once: true });
                img.addEventListener('error', onDone, { once: true });
            });
        }
        return;
    }

    // Remove any existing font size classes first to get accurate measurement
    section.classList.remove('font-small', 'font-smaller', 'font-smallest', 'font-tinier', 'font-tiniest');
    
    // Force a complete reflow after removing classes
    section.offsetHeight;
    contentDiv.offsetHeight;

    // Perform measurement immediately without setTimeout to avoid visible delay
    performMeasurement();
    
    function performMeasurement() {
        // Check if this is a two-column layout
        const hasColumns = contentDiv.querySelector('.col') !== null;

        // Force multiple reflows to ensure KaTeX formulas are fully rendered
        contentDiv.offsetHeight;
        
        // Wait for any pending KaTeX rendering
        const katexElements = contentDiv.querySelectorAll('.katex, .katex-display, mjx-container');
        if (katexElements.length > 0) {
            // Force reflow on each math element
            katexElements.forEach(el => el.offsetHeight);
        }
        
        // Calculate actual content height using direct children of content-center
        // This includes wrapper divs that contain images
        const directChildren = Array.from(contentDiv.children).filter(child => {
            // Filter out BR tags and empty elements
            return child.tagName !== 'BR' && child.getBoundingClientRect().height > 0;
        });
        
        let contentHeight = 0;
        
        if (directChildren.length > 0) {
            // Check for images and their constraints
            const imgs = contentDiv.querySelectorAll('img');
            imgs.forEach(img => {
                const rect = img.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(img);
                const sectionRect = section.getBoundingClientRect();
                const contentRect = contentDiv.getBoundingClientRect();
                
                console.log(`  -> Section width: ${sectionRect.width.toFixed(1)}px, content-center width: ${contentRect.width.toFixed(1)}px`);
                console.log(`  -> IMG inline width: ${img.style.width}, computed width: ${computedStyle.width}, actual: ${rect.width.toFixed(1)}px`);
                console.log(`  -> IMG computed max-width: ${computedStyle.maxWidth}, max-height: ${computedStyle.maxHeight}`);
                console.log(`  -> IMG transform: ${computedStyle.transform}`);
                
                // Check if Reveal.js is scaling the slide
                const revealScale = Reveal.getScale();
                console.log(`  -> Reveal.js scale: ${revealScale}`);
            });
            
            // Get all child rectangles
            const rects = directChildren.map((child, i) => {
                const rect = child.getBoundingClientRect();
                console.log(`  -> Direct child ${i} (${child.tagName}): height=${rect.height.toFixed(1)}px, top=${rect.top.toFixed(1)}, bottom=${rect.bottom.toFixed(1)}`);
                return rect;
            });
            
            // Find topmost and bottommost positions across all content elements
            const topMost = Math.min(...rects.map(r => r.top));
            const bottomMost = Math.max(...rects.map(r => r.bottom));
            
            // Content height is the span from top to bottom
            contentHeight = bottomMost - topMost;
            
            // Reveal.js scales slides - we need unscaled dimensions
            const revealScale = Reveal.getScale();
            const unscaledContentHeight = contentHeight / revealScale;
            const unscaledAvailableHeight = contentDiv.clientHeight / revealScale;
            
            console.log(`  -> Measured ${directChildren.length} direct children, bounding box: top=${topMost.toFixed(1)}, bottom=${bottomMost.toFixed(1)}, span=${contentHeight.toFixed(1)}`);
            console.log(`  -> Reveal scale: ${revealScale.toFixed(4)}, unscaled content: ${unscaledContentHeight.toFixed(1)}, unscaled available: ${unscaledAvailableHeight.toFixed(1)}`);
            
            // Use unscaled dimensions
            contentHeight = unscaledContentHeight;
        }
        
        const availableHeight = contentDiv.clientHeight / Reveal.getScale();
        const heightRatio = contentHeight / availableHeight;
        
        const h2Any = section.querySelector('h2');
        const h2Text = h2Any ? h2Any.textContent : '(no h2)';
        console.log('Slide:', h2Text, '| Content:', contentHeight.toFixed(1), '| Available:', availableHeight.toFixed(1), '| Ratio:', heightRatio.toFixed(4));

        let appliedClass = 'none';
        if (hasColumns) {
            // Check if any column contains code blocks or images
            const hasCodeInColumns = contentDiv.querySelector('.col pre') !== null;
            const hasImagesInColumns = contentDiv.querySelector('.col img') !== null;
            
            // If columns have images, adjust the ratio since images may not contribute
            // proportionally to measured height but take significant visual space
            let adjustedRatio = heightRatio;
            if (hasImagesInColumns) {
                const images = contentDiv.querySelectorAll('.col img');
                let totalImageArea = 0;
                images.forEach(img => {
                    if (img.complete) {
                        const rect = img.getBoundingClientRect();
                        totalImageArea += rect.width * rect.height;
                    }
                });
                // If images take significant space, boost the ratio
                if (totalImageArea > 0) {
                    const containerArea = availableHeight * contentDiv.clientWidth;
                    const imageRatio = totalImageArea / containerArea;
                    // Boost ratio based on image coverage
                    adjustedRatio = heightRatio + (imageRatio * 0.5);
                    console.log('  -> Images in columns, image ratio:', imageRatio.toFixed(3), 'adjusted ratio:', adjustedRatio.toFixed(4));
                }
            }
            
            if (hasCodeInColumns) {
                // For columns with code: count actual content lines more accurately
                const codeBlocks = contentDiv.querySelectorAll('.col pre code');
                let maxLines = 0;
                let totalContentLines = 0;
                
                codeBlocks.forEach(code => {
                    const text = code.textContent || '';
                    // Count non-empty lines
                    const lines = text.split('\n').filter(line => line.trim().length > 0);
                    const lineCount = lines.length;
                    maxLines = Math.max(maxLines, lineCount);
                    totalContentLines += lineCount;
                    console.log('  -> Code block lines:', lineCount, 'chars:', text.length);
                });
                
                // Also count list items and other content in columns
                const listItems = contentDiv.querySelectorAll('.col li');
                const listItemCount = listItems.length;
                totalContentLines += listItemCount;
                
                console.log('  -> Total content lines in columns:', totalContentLines, 'max code lines:', maxLines, 'list items:', listItemCount);
                
                // Apply aggressive font reduction for columns with code
                // Base font is too large for column layouts with code - default to tiniest
                if (totalContentLines <= 3 && maxLines <= 2) {
                    section.classList.add('font-smaller');
                    appliedClass = 'font-smaller';
                } else if (totalContentLines <= 5 && maxLines <= 3) {
                    section.classList.add('font-smallest');
                    appliedClass = 'font-smallest';
                } else {
                    // For most cases with code in columns, use tiniest
                    section.classList.add('font-tiniest');
                    appliedClass = 'font-tiniest';
                }
            } else {
                // Logic for columns without code - use adjustedRatio to account for images
                if (adjustedRatio > 1.15) {
                    section.classList.add('font-tiniest');
                    appliedClass = 'font-tiniest';
                } else if (adjustedRatio > 1.05) {
                    section.classList.add('font-smallest');
                    appliedClass = 'font-smallest';
                } else if (adjustedRatio > 0.95) {
                    section.classList.add('font-smaller');
                    appliedClass = 'font-smaller';
                } else if (adjustedRatio > 0.85) {
                    section.classList.add('font-small');
                    appliedClass = 'font-small';
                }
            }
        } else {
            // Non-column slides: use absolute height thresholds for all
            // Ratio is meaningless for centered content (flexbox adds empty space)
            console.log('  -> Using absolute height thresholds for non-column slide');
            
            if (contentHeight > 850) {
                section.classList.add('font-tiniest');
                appliedClass = 'font-tiniest';
            } else if (contentHeight > 750) {
                section.classList.add('font-tinier');
                appliedClass = 'font-tinier';
            } else if (contentHeight > 700) {
                section.classList.add('font-smallest');
                appliedClass = 'font-smallest';
            } else if (contentHeight > 650) {
                section.classList.add('font-smaller');
                appliedClass = 'font-smaller';
            } else if (contentHeight > 600) {
                section.classList.add('font-small');
                appliedClass = 'font-small';
            }
            // Content <= 600px: keep normal font size
        }

        console.log('  -> Applied class:', appliedClass);
    }
}

function adjustFontSizeForAllSlides() {
    // Apply auto-resize to both on-screen normal slides and print-pdf clones
    const sections = document.querySelectorAll(
        '.reveal .slides section[data-state~="normal"], .pdf-page > section[data-state~="normal"]'
    );
    
    sections.forEach((section) => {
        adjustFontSizeForSection(section);
    });
}

function syncBodyClassWithCurrentSlide() {
    const current = Reveal.getCurrentSlide();
    if (!current) return;
    const stateStr = (current.getAttribute('data-state') || '').trim();
    const tokens = stateStr ? stateStr.split(/\s+/) : [];
    const isNormal = tokens.includes('normal') || tokens.length === 0;
    document.body.classList.toggle('normal', isNormal);
}

function centerMathBlocks() {
    // KaTeX display math blocks
    const katexDisplays = document.querySelectorAll('section[data-state~="normal"] .content-center .katex-display');
    katexDisplays.forEach(math => {
        math.style.setProperty('text-align', 'center', 'important');
        math.style.setProperty('margin-left', 'auto', 'important');
        math.style.setProperty('margin-right', 'auto', 'important');
        math.style.setProperty('display', 'block', 'important');
        
        // Center the parent paragraph
        let parent = math.parentElement;
        while (parent && parent.tagName !== 'P' && parent !== document.body) {
            parent = parent.parentElement;
        }
        if (parent && parent.tagName === 'P') {
            parent.style.setProperty('text-align', 'center', 'important');
        }
    });
}
