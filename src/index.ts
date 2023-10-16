import Vue, { VueConstructor } from 'vue'
import VueI18n from 'vue-i18n'
import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import * as htmlToImage from 'html-to-image'
import { flatten } from 'flat'

class ZeroWidthEncoder {
  START = '\u200B'
  ZERO = '\u200C'
  ONE = '\u200D'
  SPACE = '\u200E'
  END = '\u200F'

  encode (text: string) {
    const binary = text
      .split('')
      .map((char) => char.charCodeAt(0).toString(2))
      .join(' ')

    const zeroWidth = binary
      .split('')
      .map((binaryNum) => {
        const num = parseInt(binaryNum, 10)
        if (num === 1) {
          return this.ONE
        } else if (num === 0) {
          return this.ZERO
        }
        return this.SPACE
      })
      .join('')
    return this.START + zeroWidth + this.END
  }

  decode (zeroWidth: string) {
    const binary = zeroWidth
      .split('')
      .slice(1, zeroWidth.length - 1) // remove START and END
      .map((char) => {
        if (char === this.ONE) {
          return '1'
        } else if (char === this.ZERO) {
          return '0'
        }
        return ' '
      })
      .join('')

    const text = binary
      .split(' ')
      .map((num) => String.fromCharCode(parseInt(num, 2)))
      .join('')
    return text
  }
}

export type TranslationMeta = {
  locale: string,
  message: string,
  values: any,
  path: string,
  uuid: string,
}

type LiveTranslatorPluginOptions = {
  i18n: VueI18n
  translationLink: (meta: TranslationMeta) => string
}

const createBadge = (meta: TranslationMeta, options: LiveTranslatorPluginOptions, prefix?: string) => {
  const badge = document.createElement('a')
  badge.classList.add('live-translator-badge')
  let title = meta.path + ': ' + meta.message
  if (prefix) {
    title = `[${prefix}] ${title}`
  }
  badge.id = meta.uuid
  badge.title = title
  badge.href = options.translationLink(meta)
  badge.target = 'popup'
  badge.addEventListener('click', (e: Event) => {
    window.open(badge.href, 'popup', 'width=600,height=600,scrollbars=no,resizable=no')
    e.preventDefault()
    return false
  })
  return badge
}

const createBox = (node: HTMLElement, attribute = false) => {
  const box = node.getBoundingClientRect()
  const div = document.createElement('div')
  div.classList.add('live-translator-box')
  div.style.position = 'fixed'
  div.style.top = box.top - 5 + 'px'
  div.style.left = box.left - 5 + 'px'
  div.style.width = box.width + 10 + 'px'
  div.style.height = box.height + 10 + 'px'
  div.style.border = 'solid 2px ' + (attribute ? 'blue' : 'red')
  div.style.zIndex = '10000'
  div.style.borderRadius = '5px'
  return div
}

const capture = async (node: HTMLElement = document.getElementById('app') as HTMLElement) => {
  const dataUrl = await htmlToImage.toJpeg(node, { quality: 0.5 })
  const link = document.createElement('a')
  link.download = 'capture.jpeg'
  link.href = dataUrl
  link.click()

  // const blob = await htmlToImage.toBlob(node, { backgroundColor: '#111214' })
  // const fileURL = window.URL.createObjectURL(blob as Blob)
  // window.open(fileURL, 'popup', 'width=600,height=600,scrollbars=no,resizable=no')
}

export const LiveTranslatorPlugin = {
  install (app: VueConstructor<Vue>, options: LiveTranslatorPluginOptions) {
    console.log('LiveTranslator enabled')
    const zw = new ZeroWidthEncoder()

    const style = document.createElement('style')
    style.id = 'live-translator-plugin-style'
    style.innerHTML = `
      .live-translator-badge-container {
        position: absolute !important;
        display: flex;
        z-index: 10000;
      }
      .live-translator-badge {
        background: green !important;
        width: 10px !important;
        height: 10px !important;
        border-radius: 10px !important;
        box-shadow: 0px 0px 5px black !important;
        opacity: 0.5 !important;
      }
      .live-translator-badge:hover {
        background: lightgreen !important;
        box-shadow: 0px 0px 5px lightgreen !important;
        opacity: 1 !important;
      }
    `
    document.head.appendChild(style)

    const i18nMessages = Object.keys(flatten(options.i18n.messages.en))
    const downloadedFiles = [] as string[]

    const visualize = async () => {
      const trash = document.querySelectorAll('.live-translator-badge, .live-translator-box')
      trash.forEach((elem) => elem.remove())

      const re = new RegExp(`${zw.START}[${zw.ZERO}${zw.ONE}${zw.SPACE}]+${zw.END}`, 'gm')

      const queue = [document.documentElement]
      while (queue.length > 0) {
        const node = queue.pop() as HTMLElement

        const badges = [] as { element: HTMLElement, meta: TranslationMeta }[]
        const boxes = [] as { element: HTMLElement, meta: TranslationMeta }[]
        const parent = node.parentElement as HTMLElement

        if (node instanceof Text) {
          const match = (node.textContent as string).match(re)
          if (node.textContent && match) {
            if (match.length > 1) {
              queue.push(node.splitText(node.textContent.indexOf(match[0]) + match[0].length) as any)
            }
            const meta = JSON.parse(zw.decode(match[0])) as TranslationMeta
            badges.push({ element: createBadge(meta, options), meta })
            boxes.push({ element: createBox(parent), meta })
          }
        }

        const attributes = (node.attributes ? [...node.attributes] : [])
          .map((attribute) => ({ attribute, match: attribute.value.match(re) }))
          .filter(({ match }) => !!match)
        for (const { attribute, match } of attributes) {
          for (const m of (match as RegExpMatchArray)) {
            const meta = JSON.parse(zw.decode(m)) as TranslationMeta
            badges.push({ element: createBadge(meta, options, attribute.name), meta })
            // boxes.push({ element: createBox(node, true), meta })
          }
        }

        if (badges.length) {
          let container = null
          if (node.previousElementSibling && node.previousElementSibling.classList.contains('live-translator-badge-container')) {
            container = node.previousElementSibling
          } else {
            container = document.createElement('span')
            container.classList.add('live-translator-badge-container')
            parent.insertBefore(container, node)
          }
          for (const badge of badges) {
            if (!document.getElementById(badge.element.id)) {
              container.appendChild(badge.element)
            }
          }
        }

        for (const box of boxes) {
          if (downloadedFiles.includes(box.meta.path)) {
            continue
          }
          (document.getElementById('app') as HTMLElement).appendChild(box.element)
          // await capture()
          console.log('download', box.meta.path)
          box.element.remove()
          downloadedFiles.push(box.meta.path)
        }

        for (const child of node.childNodes) {
          queue.push(child as any)
        }
      }
      const missing = i18nMessages.filter(key => !downloadedFiles.includes(key))
      console.log(missing)
      console.log(missing.length + '/' + i18nMessages.length)
    }

    const originalFormatter = options.i18n.formatter
    options.i18n.formatter = {
      interpolate (message, values, path) {
        const meta = zw.encode(
          JSON.stringify({
            message,
            values,
            path,
            locale: options.i18n.locale,
            uuid: uuidv4(),
          }),
        )
        const original = originalFormatter.interpolate(message, values, path) as []
        return original.map(value => `${meta}${value}`)
      },
    }

    const debounce = _.debounce(visualize, 200, { maxWait: 500 })
    const observer = new MutationObserver(debounce)
    observer.observe(document.documentElement,
      {
        subtree: true,
        attributes: true,
        characterData: true,
        childList: false,
      },
    )
    window.addEventListener('scroll', debounce)
    window.addEventListener('resize', debounce)
  },
}
