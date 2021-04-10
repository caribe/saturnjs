const balanced = require("balanced-match");
const fs = require("fs");
const path = require("path");
const glob = require("glob");

let templates = {}, scripts = {}, styles = {};
let cache = {};

function sjTemplate(context = {}, options = {}) {

	options = Object.assign({
		viewsPath: "./views",
		viewsExt: ".html",
		srcPath: "./src",
		dstPath: "./build",
	}, options);

	glob.sync(options.viewsPath+"/*"+options.viewsExt).forEach(a => {

		let name = path.basename(a, options.viewsExt);
		console.log("Module "+name);

		let src = fs.readFileSync(a, "utf8");

		let template = src.match(/<section (.*?)>(.*)<\/section>/s);
		if (template) templates[name] = template[0];

		let script = src.match(/<script>(.*)<\/script>/s);
		if (script) scripts[name] = script[1];

		let style = src.match(/<style>(.*)<\/style>/s);
		if (style) styles[name] = style[1];

	});

	console.log("");

	glob.sync(options.srcPath+"/*").forEach(fn => {
		let bn = path.basename(fn);
		if (bn[0] === "_") return;

		let dst = options.dstPath+"/"+bn;

		console.log(fn+" => "+dst);

		let res = loadTpl(fn, context);
		fs.writeFileSync(dst, res);

	});

}

function loadTpl(path, context, once = false) {
	if (once && cache[path] !== undefined) return "";
	fs.accessSync(path);
	if (cache[path] === undefined) cache[path] = fs.readFileSync(path, "utf8");
	return parseTpl(cache[path], context);
}

function parseTpl(src, context) {

	let m, p = 0, res = "";

	while (m = src.substr(p).match(/@@(\w+)/)) {

		res += src.substr(p, m.index);

		p += m.index + m[0].length;

		if (m[1] === "include" || m[1] === "include_once" || m[1] === "loop") {

			let pars = balanced('(', ')', src.substr(p));
			p += pars.end+1;

			let pp = (new Function('ctx', 'with(ctx) return ['+pars.body+']'))(context);

			let tpl = pp[0];
			let args = pp[1];

			if (m[1] === "include") {
				res += loadTpl(tpl, args);
			} else if (m[1] === "include_once") {
				res += loadTpl(tpl, args, true);
			} else if (m[1] === "loop") {
				args.forEach(a => res += loadTpl(tpl, a));
			}

		} else if (m[1] === "if") {

			let cond = balanced('(', ')', src.substr(p));
			if (!cond) throw src.substr(p, 30);
			p += cond.end+1;

			let block = balanced('{', '}', src.substr(p));
			if (!block) throw src.substr(p, 30);
			p += block.end+1;

			let f = new Function('ctx', 'with(ctx) return ('+cond.body+')');
			if (f(context)) res += parseTpl(block.body, context);

		} else if (m[1] === "sj_component") {

			let pars = balanced('(', ')', src.substr(p));
			p += pars.end+1;
			res += sjSubmodule(templates, pars.body, context);

		} else if (m[1] === "sj_style") {

			let pars = balanced('(', ')', src.substr(p));
			p += pars.end+1;
			res += sjSubmodule(styles, pars.body, context);

		} else if (m[1] === "sj_script") {

			let pars = balanced('(', ')', src.substr(p));
			p += pars.end+1;
			res += sjSubmodule(scripts, pars.body, context);

		} else {

			res += context[m[1]];

		}
	}

	res += src.substr(p);

	return res;
}

function sjSubmodule(subj, pars, context) {

	pars = pars ? new Function('ctx', 'with(ctx) return ('+pars+')')(context) : {};

	if (pars.include) {
		return Object.keys(subj)
			.filter(a => pars.include.indexOf(a) !== -1)
			.map(a => parseTpl(subj[a], context))
			.join("\n\n");
	}

	if (pars.exclude) {
		return Object.keys(subj)
			.filter(a => pars.exclude.indexOf(a) === -1)
			.map(a => parseTpl(subj[a], context))
			.join("\n\n");
	}

	return Object.values(subj)
		.map(a => parseTpl(a, context))
		.join("\n\n");
}

module.exports = sjTemplate;
