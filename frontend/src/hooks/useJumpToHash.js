import { useEffect } from 'react'

/**
 * Makes in-page evidence links work even when the target renders later (lazy lists, async data):
 * when the URL hash (e.g. #answer-7, #log-65f…) changes — or on first render — keep looking for the
 * element for up to ~3 s, then scroll to it, focus it and mark it with .is-jump-target.
 */
export function useJumpToHash(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined
    let timer = null
    let stop = null

    function jump() {
      clearInterval(timer)
      document.querySelectorAll('.is-jump-target').forEach((el) => el.classList.remove('is-jump-target'))
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id) return
      let tries = 0
      timer = setInterval(() => {
        const el = document.getElementById(id)
        if (el) {
          clearInterval(timer)
          el.classList.add('is-jump-target')
          if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.focus({ preventScroll: true })
        } else if (++tries > 30) clearInterval(timer)
      }, 100)
      stop = () => clearInterval(timer)
    }

    jump()
    window.addEventListener('hashchange', jump)
    return () => { window.removeEventListener('hashchange', jump); stop?.(); clearInterval(timer) }
  }, [enabled])
}
