# Brand

| Folder | What's inside |
| --- | --- |
| `logo/` | The official logo. `stayvinci-logo-figma.svg` is the Figma export (the source of truth). The other four files are generated from it: full logo and SV mark, each for dark and light backgrounds. |
| `documents/` | Product overview deck and product documentation. |
| `archive/` | The first logo (emerald background PNGs). Not used by the apps any more. |

The apps serve copies of the logo files from `apps/<app>/public/brand/` and show them through the `Logo` and `LogoMark` components in `packages/ui`. To change the logo, replace the files in `logo/` and copy them into each app's `public/brand/` folder.
