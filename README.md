# Bifrost

A multilingual knowledge base theme for [Zola](https://www.getzola.org/).

Named after the rainbow bridge connecting realms in Norse mythology, Bifrost bridges content and presentation for the Wheel of Heaven ecosystem.

## Features

- **Multilingual** - 9 languages supported (en, de, es, fr, ja, ko, ru, zh, zh-Hant)
- **Dark/Light Mode** - System-aware with manual toggle
- **Responsive** - Mobile-first design
- **Accessible** - WCAG 2.1 AA compliant
- **SEO Optimized** - JSON-LD schemas, meta tags, sitemaps
- **PWA Ready** - Offline support, installable

## Content Sections

| Section | Template | Description |
|---------|----------|-------------|
| Wiki | `wiki-page.html` | Encyclopedia entries |
| Timeline | `timeline-section.html` | Chronological ages |
| Library | `library-book.html` | Book reader with study tools |
| Resources | `resources-page.html` | External resource catalog |
| Essentials | `essentials-page.html` | Quick reference guides |
| Explainers | `explainer-page.html` | In-depth articles |

## Installation

Add as a submodule to your Zola site:

```bash
git submodule add https://github.com/wheelofheaven/bifrost themes/bifrost
```

Update `config.toml`:

```toml
theme = "bifrost"
```

## Structure

```
bifrost/
├── theme.toml          # Theme metadata
├── templates/          # Tera templates
│   ├── base.html       # Root template
│   ├── macros/         # Reusable macros
│   ├── partials/       # Included partials
│   └── shortcodes/     # Markdown shortcodes
├── sass/               # SCSS (7-1 architecture)
│   ├── abstracts/      # Variables, mixins
│   ├── base/           # Reset, typography
│   ├── components/     # UI components
│   ├── layout/         # Navbar, footer
│   ├── pages/          # Page-specific
│   └── themes/         # Light/dark
└── static/
    └── js/             # JavaScript modules
```

## Configuration

See `theme.toml` for available options.

## License

CC0-1.0 (Public Domain)

## Credits

Part of the [Wheel of Heaven](https://www.wheelofheaven.io) project.
