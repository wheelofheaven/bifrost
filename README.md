# Bifrost

A Zola theme for knowledge bases and encyclopedic content. Named after the rainbow bridge connecting realms in Norse mythology.

## Overview

Bifrost is the presentation layer for Wheel of Heaven, designed for multilingual, content-rich sites with features like:

- 9-language support with RTL-ready layout
- Dark/light theme with Bifrost color palette
- Wiki, timeline, library, and resource templates
- SEO and AI/AEO optimization built-in
- Responsive, accessible design

## Status

🚧 **Under Development** - Theme extraction pending

## Installation

```bash
# As a Git submodule (recommended)
git submodule add git@github.com:wheelofheaven/bifrost.git themes/bifrost

# In config.toml
theme = "bifrost"
```

## Structure

```
bifrost/
├── theme.toml           # Theme metadata
├── templates/           # Tera templates
│   ├── base.html
│   ├── macros/
│   ├── partials/
│   └── shortcodes/
├── sass/                # SCSS (7-1 architecture)
│   ├── abstracts/       # Variables, mixins, colors
│   ├── base/            # Reset, typography
│   ├── components/      # UI components
│   ├── layout/          # Navbar, footer, grid
│   ├── pages/           # Page-specific styles
│   └── themes/          # Light/dark themes
├── static/              # JS, fonts, images
└── i18n/                # Translation strings
```

## License

CC0-1.0 (Public Domain)
