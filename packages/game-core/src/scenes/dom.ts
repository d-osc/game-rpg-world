/**
 * Real DOM element factories
 * Replacement for elit/el VNode factories — returns actual HTMLElements
 * so that appendChild, innerHTML, classList, etc. work directly.
 */

function createEl(tag: string, ...args: any[]): HTMLElement {
	const el = document.createElement(tag);
	let props: Record<string, any> | null = null;
	const children: any[] = [];

	for (const arg of args) {
		if (arg && typeof arg === 'object' && !(arg instanceof HTMLElement) && !(arg instanceof Text) && !Array.isArray(arg)) {
			props = arg;
		} else {
			children.push(arg);
		}
	}

	if (props) {
		for (const [key, value] of Object.entries(props)) {
			if (value == null) continue;
			if (key === 'className') { el.className = value; continue; }
			if (key === 'style' && typeof value === 'string') { el.setAttribute('style', value); continue; }
			if (key === 'onClick') { el.addEventListener('click', value); continue; }
			if (key === 'onDblClick') { el.addEventListener('dblclick', value); continue; }
			if (key === 'onInput') { el.addEventListener('input', value); continue; }
			if (key === 'onFocus') { el.addEventListener('focus', value); continue; }
			if (key === 'onChange') { el.addEventListener('change', value); continue; }
			if (key === 'onSubmit') { el.addEventListener('submit', value); continue; }
			if (typeof value === 'function' && key.startsWith('on')) {
				el.addEventListener(key.slice(2).toLowerCase(), value);
				continue;
			}
			el.setAttribute(key, String(value));
		}
	}

	for (const child of children) {
		if (child == null || child === false) continue;
		if (child instanceof HTMLElement || child instanceof Text) el.appendChild(child);
		else if (typeof child === 'string') el.appendChild(document.createTextNode(child));
		else if (Array.isArray(child)) {
			for (const c of child) {
				if (c instanceof HTMLElement || c instanceof Text) el.appendChild(c);
				else if (typeof c === 'string') el.appendChild(document.createTextNode(c));
			}
		}
	}

	return el;
}

export function div(...args: any[]): HTMLDivElement { return createEl('div', ...args) as HTMLDivElement; }
export function p(...args: any[]): HTMLParagraphElement { return createEl('p', ...args) as HTMLParagraphElement; }
export function button(...args: any[]): HTMLButtonElement { return createEl('button', ...args) as HTMLButtonElement; }
export function span(...args: any[]): HTMLSpanElement { return createEl('span', ...args) as HTMLSpanElement; }
export function h1(...args: any[]): HTMLHeadingElement { return createEl('h1', ...args) as HTMLHeadingElement; }
export function input(props?: Record<string, any>): HTMLInputElement {
	const el = document.createElement('input');
	if (props) {
		for (const [key, value] of Object.entries(props)) {
			if (value == null) continue;
			if (key === 'className') { el.className = value; continue; }
			if (key === 'style') { el.setAttribute('style', value); continue; }
			if (typeof value === 'function' && key.startsWith('on')) {
				el.addEventListener(key.slice(2).toLowerCase(), value);
				continue;
			}
			el.setAttribute(key, String(value));
		}
	}
	return el;
}
