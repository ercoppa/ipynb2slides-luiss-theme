console.log('Custom.js loaded!');

Reveal.on('ready', function() {
    console.log('Reveal ready event fired!');
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
    
    // Wait for fonts to load, then wait for KaTeX to render before adjusting font sizes
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
            console.log('Fonts loaded!');
            // Force a reflow to ensure layout is settled
            document.body.offsetHeight;
            setTimeout(function() {
                centerMathBlocks();
                adjustFontSizeForAllSlides();
            }, 50);
        });
    } else {
        // Fallback if Font Loading API is not available
        setTimeout(function() {
            centerMathBlocks();
            adjustFontSizeForAllSlides();
        }, 50);
    }
});

Reveal.on('slidechanged', function() {
    // Re-adjust on slide change (in case of dynamic content)
    adjustFontSizeForAllSlides();
    // Sync body class for default slides on navigation
    syncBodyClassWithCurrentSlide();
    // Center math blocks on slide change
    setTimeout(centerMathBlocks, 50);
});

function adjustFontSizeForAllSlides() {
    // Apply auto-resize to both on-screen normal slides and print-pdf clones
    const sections = document.querySelectorAll(
        '.reveal .slides section[data-state~="normal"], .pdf-page > section[data-state~="normal"]'
    );
    
    sections.forEach((section) => {
        const contentDiv = section.querySelector('.content-center');
        if (!contentDiv) return;
        
        // Remove any existing font size classes first to get accurate measurement
        section.classList.remove('font-small', 'font-smaller', 'font-smallest');
        
        // Use setTimeout to ensure the class removal has taken effect
        setTimeout(() => {
            // Check if this is a two-column layout
            const hasColumns = contentDiv.querySelector('.col') !== null;
            
            let contentHeight = 0;
            if (hasColumns) {
                // For columns, get the max height of all columns
                const columns = contentDiv.querySelectorAll('.col');
                contentHeight = Math.max(...Array.from(columns).map(col => col.scrollHeight));
            } else {
                // For single column, sum up the height of all direct children
                const children = Array.from(contentDiv.children);
                contentHeight = children.reduce((sum, child) => {
                    // For pre elements, always use offsetHeight which gives the rendered box height
                    // This respects max-height constraints while giving consistent measurements
                    return sum + child.offsetHeight;
                }, 0);
            }

            // Get available height for content (clientHeight excludes padding)
            const availableHeight = contentDiv.clientHeight;
            
            // Debug: log viewport and available height
            const h2 = section.querySelector('h2');
            if (h2 && h2.textContent.includes('Long source code')) {
                console.log('DEBUG - viewport height:', window.innerHeight, 'availableHeight:', availableHeight, 'contentHeight:', contentHeight);
            }
            
            // Calculate height ratio
            const heightRatio = contentHeight / availableHeight;
            
            // Apply font size class based on how much content overflows
            // Use more aggressive thresholds for columns since they have less horizontal space
            let appliedClass = 'none';
            if (hasColumns) {
                if (heightRatio > 1.15) {
                    section.classList.add('font-smallest');
                    appliedClass = 'font-smallest';
                } else if (heightRatio > 0.95) {
                    section.classList.add('font-smaller');
                    appliedClass = 'font-smaller';
                } else if (heightRatio > 0.70) {
                    section.classList.add('font-small');
                    appliedClass = 'font-small';
                }
            } else {
                if (heightRatio > 0.85) {
                    section.classList.add('font-smallest');
                    appliedClass = 'font-smallest';
                } else if (heightRatio > 0.77) {
                    section.classList.add('font-smaller');
                    appliedClass = 'font-smaller';
                } else if (heightRatio > 0.68) {
                    section.classList.add('font-small');
                    appliedClass = 'font-small';
                }
            }
            
            console.log('Slide with h2:', section.querySelector('h2').textContent, 'Height ratio:', heightRatio, 'Applied class:', appliedClass);

        }, 0);
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
