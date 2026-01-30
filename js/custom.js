console.log('Custom.js loaded!');

Reveal.on('ready', function() {
    console.log('Reveal ready event fired!');
    
    // Wait for math rendering to complete before sizing
    // Use requestAnimationFrame to wait for next paint cycle after ready
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            centerMathBlocks();
            startResizeCycleForCurrentSlide();
            adjustFontSizeForCurrentSlide();
            setTimeout(adjustFontSizeForCurrentSlide, 150);
            setTimeout(adjustFontSizeForCurrentSlide, 500);
            if (document.body.classList.contains('print-pdf')) {
                adjustFontSizeForAllSlides();
            }
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
    startResizeCycleForCurrentSlide();
    adjustFontSizeForCurrentSlide();
    setTimeout(adjustFontSizeForCurrentSlide, 150);
    setTimeout(adjustFontSizeForCurrentSlide, 500);
    
    // Sync body class for default slides on navigation
    syncBodyClassWithCurrentSlide();
    // Center math blocks on slide change
    setTimeout(centerMathBlocks, 50);
});

function startResizeCycleForCurrentSlide() {
    const current = Reveal.getCurrentSlide();
    if (!current) return;

    // Reset monotonic selection for this slide so repeated measurements after navigation
    // cannot oscillate between font classes as math/layout settles.
    current.__fontResizeMaxRank = 0;
    current.__fontResizeMaxClass = 'none';
}

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
        
        // Calculate content height.
        // IMPORTANT: .content-center is a flex container with a fixed available height.
        // Measuring children via getBoundingClientRect can undercount when content is
        // constrained/centered. Instead:
        // 1) capture the original available height
        // 2) temporarily remove constraints (so the element can grow)
        // 3) read scrollHeight as the natural content height
        // 4) restore styles
        //
        // First, temporarily show all fragments (if any) to get accurate measurements.
        const fragments = section.querySelectorAll('.fragment');
        const fragmentStates = [];
        fragments.forEach(frag => {
            fragmentStates.push({
                element: frag,
                wasVisible: frag.classList.contains('visible'),
                display: frag.style.display
            });
            frag.classList.add('visible');
            frag.style.display = '';
        });
        
        // Force reflow
        contentDiv.offsetHeight;

        const rects = [];
        const range = document.createRange();
        range.selectNodeContents(contentDiv);
        rects.push(...Array.from(range.getClientRects()));

        const footnotes = section.querySelector('.footnotes');
        if (footnotes) {
            const footRange = document.createRange();
            footRange.selectNodeContents(footnotes);
            rects.push(...Array.from(footRange.getClientRects()));
        }

        const visibleRects = rects.filter(r => r.height > 0 && r.width > 0);
        const contentTop = contentDiv.getBoundingClientRect().top;
        const sectionBottom = section.getBoundingClientRect().bottom;

        let contentHeight = 0;
        if (visibleRects.length > 0) {
            const bottomMost = Math.max(...visibleRects.map(r => r.bottom));
            contentHeight = bottomMost - contentTop;
        }

        const availableHeight = sectionBottom - contentTop;
        
        // Restore fragment states
        fragmentStates.forEach(state => {
            if (!state.wasVisible) {
                state.element.classList.remove('visible');
            }
            if (state.display) {
                state.element.style.display = state.display;
            }
        });

        // Force reflow
        contentDiv.offsetHeight;

        const heightRatio = availableHeight > 0 ? (contentHeight / availableHeight) : 0;
        
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
            
            if (adjustedRatio > 1.05) {
                section.classList.add('font-tiniest');
                appliedClass = 'font-tiniest';
            } else if (adjustedRatio > 0.98) {
                section.classList.add('font-tinier');
                appliedClass = 'font-tinier';
            } else if (adjustedRatio > 0.92) {
                section.classList.add('font-smallest');
                appliedClass = 'font-smallest';
            } else if (adjustedRatio > 0.86) {
                section.classList.add('font-smaller');
                appliedClass = 'font-smaller';
            } else if (adjustedRatio > 0.80) {
                section.classList.add('font-small');
                appliedClass = 'font-small';
            }
        } else {
            // Non-column slides: use measured ratio (rendered content vs available box)
            console.log('  -> Using ratio thresholds for non-column slide');

            if (heightRatio > 1.10) {
                section.classList.add('font-tiniest');
                appliedClass = 'font-tiniest';
            } else if (heightRatio > 1.00) {
                section.classList.add('font-tinier');
                appliedClass = 'font-tinier';
            } else if (heightRatio > 0.95) {
                section.classList.add('font-smallest');
                appliedClass = 'font-smallest';
            } else if (heightRatio > 0.88) {
                section.classList.add('font-smaller');
                appliedClass = 'font-smaller';
            } else if (heightRatio > 0.75) {
                section.classList.add('font-small');
                appliedClass = 'font-small';
            }
            // heightRatio <= 0.75: keep normal font size
        }

        const rank = {
            none: 0,
            'font-small': 1,
            'font-smaller': 2,
            'font-smallest': 3,
            'font-tinier': 4,
            'font-tiniest': 5,
        };
        const desiredRank = rank[appliedClass] ?? 0;
        const maxRank = section.__fontResizeMaxRank ?? 0;
        const maxClass = section.__fontResizeMaxClass ?? 'none';

        if (desiredRank > maxRank) {
            section.__fontResizeMaxRank = desiredRank;
            section.__fontResizeMaxClass = appliedClass;
        } else if (desiredRank < maxRank) {
            section.classList.remove('font-small', 'font-smaller', 'font-smallest', 'font-tinier', 'font-tiniest');
            if (maxClass && maxClass !== 'none') {
                section.classList.add(maxClass);
            }
            appliedClass = maxClass;
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
