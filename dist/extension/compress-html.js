

function compressHtml(html) {
    // Define attribute whitelist by element type
    // Note: All aria-* attributes are automatically kept regardless of whitelist
    const attributeWhitelist = {
        // Form elements
        form: ['id', 'name', 'action', 'method'],
        input: ['type', 'name', 'id', 'placeholder', 'value', 'required', 'autocomplete',
            'data-form-filler-target', 'data-focused'],
        select: ['name', 'id', 'required'],
        option: ['value', 'selected'],
        textarea: ['name', 'id', 'placeholder', 'required'],
        button: ['type', 'id'],

        // Structure elements
        label: ['for', 'id'],
        div: ['id', 'role', 'data-form-filler-target'],
        span: ['id', 'role'],
        section: ['id'],

        // Headings
        h1: ['id'],
        h2: ['id'],
        h3: ['id'],

        // Other
        p: ['id'],

        // Default for unknown elements - keep essential attributes
        '*': ['id', 'name', 'type', 'role', 'data-form-filler-target']
    };

    // Get whitelist for an element
    function getAllowedAttributes(tagName) {
        const normalized = tagName.toLowerCase();
        return attributeWhitelist[normalized] || attributeWhitelist['*'];
    }

    // Step 1: Remove all SVG elements and their content
    html = html.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');

    // Step 2: Remove template elements
    html = html.replace(/<template[^>]*>[\s\S]*?<\/template>/gi, '');

    // Step 3: Remove elements with aria-hidden="true" (but preserve their content if it's a select)
    html = html.replace(/<div[^>]*aria-hidden="true"[^>]*>([\s\S]*?)<\/div>/gi, (match, content) => {
        if (/<select/i.test(content)) {
            return content.match(/<select[\s\S]*?<\/select>/gi)?.[0] || '';
        }
        return '';
    });


    // Step 6: Truncate long option lists FIRST (before other processing) - keep only 8 examples
    html = html.replace(/<select[^>]*>([\s\S]*?)<\/select>/gi, (match, content) => {
        const options = content.match(/<option[^>]*>[\s\S]*?<\/option>/gi) || [];
        if (options.length > 8) {
            const firstEmpty = options.find(opt => /<option[^>]*>\s*<\/option>/i.test(opt));
            const nonEmpty = options.filter(opt => !/<option[^>]*>\s*<\/option>/i.test(opt));

            let newContent = '';
            if (firstEmpty) newContent += firstEmpty;
            newContent += nonEmpty.slice(0, 7).join('');

            return match.replace(content, newContent);
        }
        return match;
    });

    // Step 7: Remove style and class attributes (always remove these)
    html = html.replace(/\s+style="[^"]*"/gi, '');
    html = html.replace(/\s+class="[^"]*"/gi, '');


    // Step 9: Process each element and keep only whitelisted attributes
    html = html.replace(/<([a-z][a-z0-9]*)([^>]*)>/gi, (match, tagName, attributes) => {
        const allowedAttrs = getAllowedAttributes(tagName);
        const attrMap = new Map();

        // Parse all attributes (handle both quoted and unquoted values)
        // Match: name="value", name='value', or name=value, or just name (boolean)
        const attrRegex = /([a-z][a-z0-9-]*(?:-[a-z0-9-]*)*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;
        let attrMatch;

        while ((attrMatch = attrRegex.exec(attributes)) !== null) {
            const name = attrMatch[1].toLowerCase();
            const value = attrMatch[2] || attrMatch[3] || attrMatch[4] || '';

            // Keep all aria-* attributes (they provide useful context)
            if (name.startsWith('aria-')) {
                attrMap.set(name, value);
            }
            // Keep whitelisted attributes
            else if (allowedAttrs.includes(name)) {
                attrMap.set(name, value);
            }
            // Keep whitelisted data-* attributes
            else if (name.startsWith('data-') && allowedAttrs.includes(name)) {
                attrMap.set(name, value);
            }
        }

        // Build new attributes string
        let newAttributes = '';
        attrMap.forEach((value, name) => {
            if (value) {
                newAttributes += ` ${name}="${value}"`;
            } else {
                newAttributes += ` ${name}`;
            }
        });

        return `<${tagName}${newAttributes}>`;
    });


    // Step 11: Remove empty attributes
    html = html.replace(/\s+value=""/gi, '');
    html = html.replace(/\s+value(?![=])/gi, ''); // Remove standalone 'value' attribute
    html = html.replace(/\s+title=""/gi, '');

    // Step 17: Remove standalone option tags that aren't in selects
    html = html.replace(/(?<!<select[^>]*>[\s\S]*?)<option[^>]*>[\s\S]*?<\/option>(?![\s\S]*?<\/select>)/gi, '');

    // Step 23: Minify whitespace
    html = html.replace(/\s+/g, ' ');
    html = html.replace(/>\s+</g, '><');
    html = html.trim();

    // Step 24: Remove any remaining empty attributes
    html = html.replace(/\s+[a-z-]+=""/gi, '');

    return html;
}
