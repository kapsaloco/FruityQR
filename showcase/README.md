# FruityUI showcase

FruityUI 1.1.1 includes the FruityHash 1.0 foundation, the reusable controls from
FruityPalette, and the tab and dialog refinements from FruityQR. FruityQR is the
source for this release. The UI version is independent of the app version.
See the [changelog](../src/styles/fruity/CHANGELOG.md).

Run `npm ci` and `npm run build:showcase` once to generate the offline pages.
Double-click `dist-showcase/offline/v1.1/fruity.html` to open the showcase in a
browser. The HTML contains its styles, artwork, and interactive demos. Keep the
`offline` folder together when sharing it so the version and workflow links work.

When editing the showcase, run `npm run dev` and open the [1.1.1 component
source](v1.1/fruity.html) at `http://localhost:1420/showcase/v1.1/fruity.html`.
The [1.1 file workflows](v1.1/workflow.html) show the existing FruityHash file
selection, progress, results, and comparison fixtures.

## Using FruityUI in another app

Copy the complete [shared directory](../src/styles/fruity), then follow its
[integration guide](../src/styles/fruity/README.md). The guide, license, and
changelog travel with the library.

## Carry the showcase forward

To run the showcase from the new Vite app, also copy `showcase/` and the
showcase’s color demo helper `src/color.ts`. If the host already has a
`src/color.ts`, keep its file and update the import in
`showcase/v1.1/new-examples.ts` to point to the copied helper at a distinct path.
Include `showcase/**/*.ts` in the host TypeScript configuration and add a
`build:showcase` script with the command `tsc && node showcase/build-offline.mjs`.
The builder uses the host’s installed Vite 8. Open the existing offline build
from FruityQR if you only need a reference while developing the new app.

The 1.1.1 showcase includes the changelog and links to the
[archived 1.0 components](v1.0/fruity.html) and
[archived 1.0 file workflows](v1.0/workflow.html).

Use a patch release for refinements to existing components and examples. Use a
minor release for a new reusable component. Carry the earlier examples forward
and update both the shared changelog and the showcase changelog.
