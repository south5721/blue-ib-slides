# Third-party notices

No third-party source, icon paths, fonts or native binaries are vendored in this repository. npm dependencies retain their own licenses in their installed packages.

## pptxgenjs

Pinned runtime dependency. License: MIT. [Upstream](https://github.com/gitbrent/PptxGenJS/blob/v4.0.1/LICENSE); complete license in `licenses/PptxGenJS-MIT.txt`.

## @napi-rs/canvas

Pinned runtime dependency. License: MIT. [Upstream](https://github.com/Brooooooklyn/canvas/blob/v0.1.100/LICENSE); complete license in `licenses/napi-rs-canvas-MIT.txt`.

## Fonts

No font files are distributed. Noto Sans CJK is an optional external font under SIL OFL 1.1. Other fonts remain governed by their own licenses.

## Locked transitive dependencies

The lockfile inventory is in `licenses/dependency-inventory.json`. JSZip offers MIT or GPL; this project uses the MIT option. Pako declares MIT and Zlib. ISC-licensed dependencies retain their notices. These packages are installed from npm and are not vendored into the source repository.

## Optional PPT Master integration

The original local bridge can call an existing [hugohe3/ppt-master](https://github.com/hugohe3/ppt-master) installation (MIT; Copyright (c) 2025–2026 Hugo He). No upstream implementation, artwork, icons, templates, fonts or binaries are vendored. Copies of upstream code/documentation, if added separately, must retain its full copyright and MIT license. The bridge never installs or updates that project.

## Optional lxml

Template compaction optionally uses lxml (BSD-3-Clause, with libxml2/libxslt under their respective licenses). It is installed separately and not bundled. See its installed distribution notices.
