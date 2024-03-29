#!/usr/bin/env node

const libpath = require('path'),
      prompts = require('prompts'),
      rimraf = require('rimraf'),
      chalk = require('chalk'),
      rif = require('replace-in-file'),
      cp = require('child_process'),
      fs = require('fs');

async function main() {

	let path_to_folder,
	    cwd = process.cwd();

	if (process.argv.length >= 3) {
		path_to_folder = process.argv[2];
	}

	if (!path_to_folder) {

		console.log('Let\'s set up your', chalk.yellow.bgBlack.bold('Alchemy'), 'project!\n');


		path_to_folder = await prompts({
			type     : 'text',
			name     : 'value',
			message  : 'What is the name of the project?',
			validate : value => {
				value = value.trim();

				if (!value) {
					return 'Project name can not be empty';
				}

				if (value.indexOf(' ') > -1) {
					return 'Project name can not contain spaces';
				}

				return true;
			}
		});

		path_to_folder = path_to_folder.value;

		console.log('');
	}

	let absolute_path_to_folder = libpath.resolve(cwd, path_to_folder);
	let pretty_path_to_folder = chalk.magenta.bgBlack.bold(absolute_path_to_folder);

	if (!fs.existsSync(path_to_folder)) {
		try {
			fs.mkdirSync(path_to_folder);
		} catch (err) {
			console.error('Failed to create folder', pretty_path_to_folder, ', received error:', err.message);
			process.exit(1);
			return;
		}
	} else {
		let contents = fs.readdirSync(path_to_folder);

		if (contents.length > 0) {
			console.error('Failed to initialize a new project, the project folder', pretty_path_to_folder, 'already contains files');
			process.exit(1);
			return;
		}
	}

	path_to_folder = absolute_path_to_folder;
	let project_name = libpath.basename(absolute_path_to_folder);

	console.log('Creating project', chalk.black.bgYellow.bold(project_name), '\n');

	console.log('Cloning alchemy-skeleton to', chalk.bold(path_to_folder));
	const clone = cp.spawnSync('git', ['clone', '--depth', '1', 'https://github.com/11ways/alchemy-skeleton.git', path_to_folder]);

	if (clone.status !== 0) {
		console.error(chalk.red.bold('Failed to clone the skeleton!'));
		return process.exit(clone.status);
	}

	console.log(chalk.green.bold('Cloned alchemy-skeleton template!\n'));

	let git_path = libpath.resolve(path_to_folder, '.git');

	console.log('Going to remove .git directory at', chalk.bold(git_path));

	try {
		rimraf.sync(git_path);
	} catch (err) {
		console.error(chalk.red.bold('Failed to remove .git directory:'));
		throw err;
	}

	console.log(chalk.green.bold('Removed .git directory!\n'));

	console.log('Going to replace', chalk.black.bgYellow.bold('__alchemy_project_name__'), 'placeholder with project name', chalk.black.bgYellow.bold(project_name), '...');

	let files = rif.sync({
		files : [
			libpath.resolve(path_to_folder, '*'),
			libpath.resolve(path_to_folder, '**', '*'),
		],
		from  : /__alchemy_project_name__/g,
		to    : project_name
	});

	let count = 0;

	for (let file of files) {
		if (file.hasChanged) {
			count++;
		}
	}

	console.log(chalk.green.bold('Replaced in', chalk.magenta.bold(count), 'files!\n'));

	fs.writeFileSync(libpath.resolve(path_to_folder, 'README.md'), `# ${project_name}

	Your application made with Node.js and the Alchemy MVC

	## Installation

	Install the required packages by executing this command:

	\`\`\`bash
	npm install
	\`\`\`

	You can run the server by executing:

	\`\`\`bash
	node server.js
	\`\`\`
	`);

	// Adjust package.json file (change name)
	// Also changes installed versions, but we don't actually do npm install yet
	adjustPkgJson(path_to_folder);

	function loadJSON(path) {
		let path_to_file = libpath.resolve(__dirname, path);
		return require(path_to_file);
	}

	function adjustPkgJson(folder) {
		const packageJson = loadJSON(`${folder}/package.json`),
			devDeps = packageJson.devDependencies,
			deps = packageJson.dependencies;

		// Mutate the objects and write new values for the version.
		deps && transformVersion(deps, folder);
		devDeps && transformVersion(devDeps, folder);

		// Change the name
		packageJson.name = project_name;

		const finalData = JSON.stringify(packageJson, null, '\t');
		fs.writeFileSync(`${folder}/package.json`, finalData, 'utf-8');
	}

	// This function mutates the original object.
	function transformVersion(obj, folder) {
		Object.keys(obj).forEach(pkg => {
			var location = `${folder}/node_modules/${pkg}/package.json`,
				package,
				version;

			try {
				package = loadJSON(location);
				version = package.version;
			} catch (err) {
				// Ignore;
			}

			if (!version) {
				return;
			}

			obj[pkg] = `~${version}`
		})
	}
}

main();