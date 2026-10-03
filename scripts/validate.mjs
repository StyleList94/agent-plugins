// Validate shared plugin catalogs, manifests, and bundled skill resources.
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'));
const read = (path) => readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
function check(condition, message) {
  if (!condition) throw new Error(message);
}

const pluginNames = (catalog) => [...new Set(catalog.plugins.map((p) => p.name))].sort();
const validateCatalogs = (claude, codex) => {
  check(claude.name === codex.name, 'Marketplace names differ');
  check(JSON.stringify(pluginNames(claude)) === JSON.stringify(pluginNames(codex)), 'Marketplace plugin sets differ');
};

const validateScripts = (skillRoot, name) => {
  const scriptsRoot = join(skillRoot, 'scripts');
  if (!existsSync(scriptsRoot)) return;
  readdirSync(scriptsRoot)
    .filter((file) => file.endsWith('.sh'))
    .forEach((script) => {
      check(statSync(join(scriptsRoot, script)).size > 0, `${name}: empty script ${script}`);
    });
};

const validateSkill = (skillRoot, label) => {
  const body = read(join(skillRoot, 'SKILL.md'));
  const header = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  check(header !== undefined, `${label}: missing frontmatter`);
  const name = header.match(/^name: (.+)$/m)?.[1].trim();
  check(name, `${label}: missing or duplicate skill name`);
  check(/^description: /m.test(header), `${name}: missing description`);
  check(body.includes('## Agent compatibility'), `${name}: missing agent compatibility section`);
  check(!body.includes('${CLAUDE_SKILL_DIR}'), `${name}: contains Claude-only skill directory variable`);
  validateScripts(skillRoot, name);
  return { name, label };
};

const validatePlugin = (root, claude, entry) => {
  const { source } = entry;
  const label = entry.name;
  check(source.source === 'local' && source.path.startsWith('./'), `${label}: expected a relative local source`);
  const pluginRoot = realpathSync(join(root, source.path));
  const pathWithinRoot = relative(root, pluginRoot);
  check(!isAbsolute(pathWithinRoot) && pathWithinRoot !== '..' && !pathWithinRoot.startsWith('../'), `${label}: source escapes repository`);
  const original = claude.plugins.find((p) => p.name === label);
  check(realpathSync(join(root, original.source)) === pluginRoot, `${label}: host source paths differ`);
  const manifest = json(join(pluginRoot, '.codex-plugin/plugin.json'));
  check(manifest.name === label, `${label}: manifest name differs`);
  check(manifest.skills === './skills/', `${label}: expected skills path ./skills/`);
  const claudePath = join(pluginRoot, '.claude-plugin/plugin.json');
  const claudeMetadata = existsSync(claudePath) ? json(claudePath) : original;
  check(!('version' in manifest) && !('version' in claudeMetadata) && !('version' in original), `${label}: omit plugin versions`);
  const skillsRoot = join(pluginRoot, 'skills');
  const skills = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((dir) => dir.isDirectory() && existsSync(join(skillsRoot, dir.name, 'SKILL.md')));
  check(skills.length > 0, `${label}: no skills found`);
  return skills.map((skill) => validateSkill(join(skillsRoot, skill.name), `${label}/${skill.name}`));
};

const validateUniqueSkills = (skills) => {
  skills.forEach(({ name, label }, index) => {
    check(skills.findIndex((skill) => skill.name === name) === index, `${label}: missing or duplicate skill name`);
  });
};

const validateRepository = (root) => {
  const claude = json(join(root, '.claude-plugin/marketplace.json'));
  const codex = json(join(root, '.agents/plugins/marketplace.json'));
  validateCatalogs(claude, codex);
  const skills = codex.plugins.flatMap((entry) => validatePlugin(root, claude, entry));
  validateUniqueSkills(skills);
  return { plugins: codex.plugins.length, skills: skills.length };
};

const result = validateRepository(root);
console.log(`Validated ${result.plugins} plugins and ${result.skills} shared skills`);
