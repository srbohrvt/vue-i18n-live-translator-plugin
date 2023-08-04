import throttle from 'lodash/throttle';
const css = `
.live-translator-enable-button {
  position: fixed !important;
  top: 0;
  left: 0;
  z-index: 10000;
  padding: 2px;
  color: black;
  background: rgba(255, 255, 255, 0.6);
  font-family: sans-serif;
  font-size: 8px;
}
.live-translator-enable-button:hover {
  background: white;
}
.live-translator-enable-button-indicator {
  display: inline-block;
  height: 6px;
  width: 6px;
  margin-left: 2px;
  border-radius: 100%;
  background-color: red;
}
.live-translator-badge-wrapper {
  position: relative !important;
  width: 0px;
  height: 0px;
}
.live-translator-badge-container {
  position: absolute !important;
  display: flex;
  z-index: 10000;
}
.live-translator-badge {
  width: 10px !important;
  height: 10px !important;
  border-radius: 10px !important;
  box-shadow: 0px 0px 5px black !important;
  opacity: 0.5 !important;
}
.live-translator-badge:hover {
  opacity: 1 !important;
}
.live-translator-badge.text {
  background: green !important;
}
.live-translator-badge.text:hover {
  background: lightgreen !important;
  box-shadow: 0px 0px 5px lightgreen !important;
}
.live-translator-badge.attribute {
  background: blue !important;
}
.live-translator-badge.attribute:hover {
  background: #00c0ff !important;
  box-shadow: 0px 0px 5px #00c0ff !important;
}
`;
class ZeroWidthEncoder {
    static START = '\u200B';
    static ZERO = '\u200C';
    static ONE = '\u200D';
    static SPACE = '\u200E';
    static END = '\u200F';
    static PATTERN = `${this.START}[${this.ZERO}${this.ONE}${this.SPACE}]+${this.END}`;
    static encode(text) {
        const binary = text
            .split('')
            .map((char) => char.charCodeAt(0).toString(2))
            .join(' ');
        const zeroWidth = binary
            .split('')
            .map((binaryNum) => {
            const num = parseInt(binaryNum, 10);
            if (num === 1) {
                return this.ONE;
            }
            else if (num === 0) {
                return this.ZERO;
            }
            return this.SPACE;
        })
            .join('');
        return this.START + zeroWidth + this.END;
    }
    static decode(zeroWidth) {
        const binary = zeroWidth
            .split('')
            .slice(1, zeroWidth.length - 1) // remove START and END
            .map((char) => {
            if (char === this.ONE) {
                return '1';
            }
            else if (char === this.ZERO) {
                return '0';
            }
            return ' ';
        })
            .join('');
        const text = binary
            .split(' ')
            .map((num) => String.fromCharCode(parseInt(num, 2)))
            .join('');
        return text;
    }
}
class LiveTranslatorManager {
    _enabled;
    _options;
    _enableButton;
    _indicator;
    constructor(options) {
        this._enabled = false;
        this._options = options;
        // handle persistance
        const savedRaw = localStorage.getItem('live-translator-enabled');
        if (this._options.persist && savedRaw) {
            const saved = JSON.parse(savedRaw);
            if (typeof saved === 'boolean') {
                this.toggle(saved);
            }
        }
        // initialize UI
        this._enableButton = document.createElement('button');
        this._indicator = document.createElement('span');
        const style = document.createElement('style');
        style.id = 'live-translator-plugin-style';
        style.innerHTML = css;
        document.head.appendChild(style);
        this._enableButton.innerText = 'LT';
        this._enableButton.classList.add('live-translator-enable-button');
        this._indicator.classList.add('live-translator-enable-button-indicator');
        this._enableButton.appendChild(this._indicator);
        this._enableButton.addEventListener('click', () => {
            this.toggle();
            this.refreshI18n();
            this.render();
        });
        document.body.appendChild(this._enableButton);
        // initialize encode
        const originalFormatter = this._options.i18n.formatter;
        const self = this;
        this._options.i18n.formatter = {
            interpolate(message, values, path) {
                const original = originalFormatter.interpolate(message, values, path);
                let meta = '';
                try {
                    // filter nested objects, replace inner objects with string 'object'
                    // this is needed when values from <i18n> tags are circular dependent objects
                    const filteredValues = Object.fromEntries(Object.entries(values || {})
                        .map(([key, value]) => [key, typeof value !== 'object' ? value : 'object']));
                    meta = ZeroWidthEncoder.encode(JSON.stringify({
                        message,
                        values: filteredValues,
                        path,
                        locale: self._options.i18n.locale,
                    }));
                }
                catch (exception) {
                    console.warn(message, values, path, self._options.i18n.locale, exception);
                }
                return (original && meta && self._enabled) ? [meta, ...original] : original;
            },
        };
        // initialize decode & render
        const throttler = throttle(() => this.render(), 800);
        const observer = new MutationObserver(throttler);
        observer.observe(document.documentElement, {
            subtree: true,
            attributes: true,
            characterData: true,
            childList: false,
        });
        document.documentElement.addEventListener('mousemove', throttler);
        // render for the first time
        this.refreshI18n();
        this.render();
    }
    refreshI18n() {
        const originalLocale = this._options.i18n.locale;
        this._options.i18n.locale = '';
        this._options.i18n.locale = originalLocale;
    }
    toggle(enable) {
        if (enable !== undefined) {
            this._enabled = enable;
        }
        else {
            this._enabled = !this._enabled;
        }
        if (this._options.persist) {
            localStorage.setItem('live-translator-enabled', JSON.stringify(this._enabled));
        }
        console.log(`%c Live Translator ${this._enabled ? 'ON' : 'OFF'} `, 'background: #222; color: #bada55');
    }
    render() {
        const badgeWrappers = document.querySelectorAll('.live-translator-badge-wrapper');
        badgeWrappers.forEach((wrapper) => {
            wrapper.remove();
        });
        this._indicator.style.background = this._enabled ? 'lightgreen' : 'red';
        if (!this._enabled) {
            return;
        }
        const re = new RegExp(ZeroWidthEncoder.PATTERN, 'gm');
        const queue = [document.documentElement];
        while (queue.length > 0) {
            const node = queue.pop();
            const badges = [];
            const parent = node.parentElement;
            if (node instanceof Text) {
                const matches = node.textContent.match(re);
                for (const match of matches ?? []) {
                    const meta = JSON.parse(ZeroWidthEncoder.decode(match));
                    badges.push(createBadge(meta, this._options));
                }
            }
            const attributes = (node.attributes ? [...node.attributes] : [])
                .map((attribute) => ({ attribute, match: attribute.value.match(re) }))
                .filter(({ match }) => !!match);
            for (const { attribute, match } of attributes) {
                for (const m of match) {
                    const meta = JSON.parse(ZeroWidthEncoder.decode(m));
                    badges.push(createBadge(meta, this._options, attribute.name));
                }
            }
            if (badges.length) {
                let container;
                if (node.previousElementSibling && node.previousElementSibling.classList.contains('live-translator-badge-container')) {
                    container = node.previousElementSibling;
                }
                else {
                    container = document.createElement('span');
                    container.classList.add('live-translator-badge-container');
                    const relativeWrapper = document.createElement('span');
                    relativeWrapper.classList.add('live-translator-badge-wrapper');
                    relativeWrapper.appendChild(container);
                    parent.insertBefore(relativeWrapper, node);
                }
                for (const badge of badges) {
                    container.appendChild(badge);
                }
            }
            for (const child of node.childNodes) {
                queue.push(child);
            }
        }
    }
}
const createBadge = (meta, options, attribute) => {
    const badge = document.createElement('a');
    badge.classList.add('live-translator-badge');
    let title = meta.path + ': ' + meta.message;
    if (attribute) {
        title = `[${attribute}] ${title}`;
        badge.classList.add('attribute');
    }
    else {
        badge.classList.add('text');
    }
    badge.title = title;
    badge.href = options.translationLink(meta);
    badge.target = 'popup';
    badge.addEventListener('click', (e) => {
        window.open(badge.href, 'popup', 'width=600,height=600,scrollbars=no,resizable=no');
        e.preventDefault();
        return false;
    });
    return badge;
};
export const LiveTranslatorPlugin = {
    install(app, options) {
        console.log('LiveTranslator is installed');
        new LiveTranslatorManager(options);
    },
};
