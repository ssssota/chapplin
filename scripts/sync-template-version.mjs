import * as fs from "node:fs";
import * as path from "node:path";

const chapplinPackageJsonPath = path.resolve("packages/chapplin/package.json");
const chapplinPackageJson = JSON.parse(
	fs.readFileSync(chapplinPackageJsonPath, "utf-8"),
);
const chapplinVersion = chapplinPackageJson.version;

const templatesDir = path.resolve("packages/create-chapplin/templates");
const templatesPath = fs.readdirSync(templatesDir, { withFileTypes: true });
for (const dirent of templatesPath) {
	if (!dirent.isDirectory()) continue;

	const templatePackageJsonPath = path.resolve(
		templatesDir,
		dirent.name,
		"package.json",
	);
	const templatePackageJson = JSON.parse(
		fs.readFileSync(templatePackageJsonPath, "utf-8"),
	);
	templatePackageJson.devDependencies.chapplin = `^${chapplinVersion}`;

	fs.writeFileSync(
		templatePackageJsonPath,
		JSON.stringify(templatePackageJson),
		"utf-8",
	);
}
