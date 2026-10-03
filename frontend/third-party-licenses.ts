import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';

const OUTPUT = 'third-party-licenses.txt';
const APPLICATION_LICENSE = new URL('../LICENSE', import.meta.url);
const NOTICE_FILE = /^(?:licen[cs]e|copying|notice)(?:[._-]|$)/i;
type Package = {
  directory: string;
  name: string;
  version: string;
  license?: string;
  dependencies?: Record<string, string>;
};
type Notice = { file: string; text: string };

function readNotice(directory: string, file: string): Notice {
  const text = readFileSync(join(directory, file), 'utf8').trim();
  if (!text) throw new Error(`Empty third-party notice: ${directory}/${file}`);
  return { file, text };
}

function packageNotices(pkg: Package): Notice[] {
  const notices = readdirSync(pkg.directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && NOTICE_FILE.test(entry.name))
    .map((entry) => readNotice(pkg.directory, entry.name));

  if (pkg.name === 'isarray') {
    const text = readNotice(pkg.directory, 'README.md').text.match(
      /## License\r?\n([\s\S]+)$/,
    )?.[1];
    if (!text?.includes('Permission is hereby granted'))
      throw new Error('isarray README license format changed; review its attribution.');
    notices.push({ file: 'README.md — License', text: text.trim() });
  }
  if (pkg.name === 'pako') {
    // The root license covers the port; its zlib source carries a second notice.
    const text = readNotice(pkg.directory, 'lib/zlib/inflate.js').text.match(
      /\/\/ \(C\)[\s\S]*?(?=\r?\n\r?\n(?:var|const|let) )/,
    )?.[0];
    if (!text?.includes('This notice may not be removed or altered'))
      throw new Error('pako zlib notice format changed; review its attribution.');
    notices.push({ file: 'lib/zlib/inflate.js — zlib notice', text });
  }
  if (pkg.name === 'pdfjs-dist') {
    // The package license has no owner attribution; the source headers do.
    for (const file of ['build/pdf.mjs', 'web/pdf_viewer.css']) {
      const text = readNotice(pkg.directory, file).text.match(/^\/\*[\s\S]*?\*\//)?.[0];
      if (!text?.includes('Mozilla Foundation') || !text.includes('Apache License'))
        throw new Error(`PDF.js attribution format changed in ${file}; review it.`);
      notices.push({ file, text });
    }
    notices.push({
      file: 'LegalThink adaptation',
      text: 'The PDF.js text-layer geometry from web/pdf_viewer.css is adapted in frontend/src/source-preview.css.',
    });
  }
  if (!notices.length)
    throw new Error(`No license text found for delivered package ${pkg.name}@${pkg.version}.`);
  return notices.sort((a, b) => a.file.localeCompare(b.file, 'en'));
}

/** Collect delivered modules and assets, including lazy chunks, fonts and PDF resources. */
export function thirdPartyLicenses(): Plugin {
  return {
    name: 'third-party-licenses',
    configureServer(server) {
      const paths = new Map<string, string | URL>([
        ['/LICENSE.txt', APPLICATION_LICENSE],
        [`/${OUTPUT}`, resolve(server.config.root, server.config.build.outDir, OUTPUT)],
      ]);
      server.middlewares.use((request, response, next) => {
        const path = paths.get(request.url?.split('?')[0] ?? '');
        if (!path) return next();
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        let text: string;
        try {
          text = readFileSync(path, 'utf8');
          if (!text.trim()) throw new Error('Empty license file.');
        } catch {
          response.statusCode = 503;
          text =
            path === APPLICATION_LICENSE
              ? 'Die LICENSE-Datei im Projekt fehlt oder ist nicht lesbar.'
              : 'Drittanbieter-Lizenzhinweise fehlen. Zuerst npm run build ausführen.';
        }
        response.end(request.method === 'HEAD' ? undefined : text);
      });
    },
    generateBundle(_, bundle) {
      const packages = new Map<string, Package>();
      const resourceNotices = new Map<string, Notice[]>();
      const cache = new Map<string, Package>();

      function owner(id: string): Package | undefined {
        const file = id.split('?')[0].replaceAll('\\', '/');
        if (file.startsWith('\0') || !file.includes('/node_modules/')) return;
        const start = dirname(resolve(file));
        const cached = cache.get(start);
        if (cached) return cached;
        for (
          let directory = start;
          dirname(directory) !== directory;
          directory = dirname(directory)
        ) {
          const manifest = join(directory, 'package.json');
          if (!existsSync(manifest)) continue;
          const data = JSON.parse(readFileSync(manifest, 'utf8')) as Partial<Package>;
          if (!data.name || !data.version) continue;
          const pkg = { ...data, directory, name: data.name, version: data.version };
          cache.set(start, pkg);
          return pkg;
        }
        throw new Error(`No package metadata found for delivered module or asset: ${file}`);
      }

      function include(id: string, resource = false) {
        const pkg = owner(id);
        if (!pkg) return;
        const key = `${pkg.name}@${pkg.version}`;
        packages.set(key, pkg);
        if (resource && NOTICE_FILE.test(id.split(/[\\/]/).at(-1) ?? '')) {
          const notices = resourceNotices.get(key) ?? [];
          const file = id
            .replaceAll('\\', '/')
            .slice(pkg.directory.replaceAll('\\', '/').length + 1);
          if (!notices.some((notice) => notice.file === file))
            notices.push(readNotice(pkg.directory, file));
          resourceNotices.set(key, notices);
        }
      }

      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') output.moduleIds.forEach((id) => include(id));
        else output.originalFileNames.forEach((id) => include(id, true));
      }
      // JSZip's browser entry is already bundled. Its production dependencies
      // therefore do not appear as individual modules in Vite's chunk graph.
      function includeVendoredDependencies(pkg: Package) {
        const require = createRequire(join(pkg.directory, 'package.json'));
        for (const name of Object.keys(pkg.dependencies ?? {})) {
          const dependency = owner(require.resolve(`${name}/package.json`));
          if (!dependency) throw new Error(`Cannot attribute vendored dependency ${name}.`);
          const key = `${dependency.name}@${dependency.version}`;
          if (packages.has(key)) continue;
          packages.set(key, dependency);
          includeVendoredDependencies(dependency);
        }
      }
      const jszip = [...packages.values()].find((pkg) => pkg.name === 'jszip');
      if (jszip) includeVendoredDependencies(jszip);
      if (!packages.size) throw new Error('The build contains no attributable dependency modules.');

      const sections = [...packages.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'en'))
        .map(([key, pkg]) => {
          const notices = [...packageNotices(pkg), ...(resourceNotices.get(key) ?? [])];
          return [
            `## ${key}${pkg.license ? ` (${pkg.license})` : ''}`,
            ...notices.map(({ file, text }) => `### ${file}\n\n${text}`),
          ].join('\n\n');
        });
      this.emitFile({
        type: 'asset',
        fileName: OUTPUT,
        source: [
          'Third-party licenses and notices',
          'These notices cover dependencies included in this build. The LegalThink application license is provided separately in LICENSE.txt.',
          ...sections,
          '',
        ].join('\n\n'),
      });
      const applicationLicense = readFileSync(APPLICATION_LICENSE, 'utf8');
      if (!applicationLicense.trim()) throw new Error('The application LICENSE is empty.');
      this.emitFile({ type: 'asset', fileName: 'LICENSE.txt', source: applicationLicense });
    },
  };
}
