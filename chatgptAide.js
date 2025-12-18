(function () {
    if (document.getElementById('__paste_to_thread_btn__')) return;

    function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    // ✅ React/现代框架更容易识别的写入方式
    function setNativeValue(el, value) {
        const proto = Object.getPrototypeOf(el);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        const setter = desc && desc.set;
        if (setter) setter.call(el, value);
        else el.value = value;
    }

    function fillTextareaHumanLike(textarea, text) {
        textarea.focus();

        // beforeinput（更接近真实输入链）
        try {
            textarea.dispatchEvent(
                new InputEvent('beforeinput', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: text,
                })
            );
        } catch (e) {
            // 某些环境 InputEvent 不完整，忽略即可
        }

        // 用原生 setter 设置值（React 常依赖这个）
        setNativeValue(textarea, text);

        // input（关键：触发框架状态更新）
        try {
            textarea.dispatchEvent(
                new InputEvent('input', {
                    bubbles: true,
                    inputType: 'insertText',
                    data: text,
                })
            );
        } catch (e) {
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // change（有些页面靠 change 才算“有效输入”）
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function waitForVisibleTextarea(thread, timeoutMs = 2000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const ta = thread.querySelector('article textarea');
            if (ta && isVisible(ta)) return ta;
            await new Promise(r => setTimeout(r, 50));
        }
        return null;
    }

    const btn = document.createElement('button');
    btn.id = '__paste_to_thread_btn__';
    btn.textContent = '📋 粘贴到输入框';
    btn.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 999999;
    padding: 8px 12px;
    background: #111;
    color: #fff;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 14px;
  `;

    btn.onclick = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return alert('剪贴板为空');

            const thread = document.querySelector('#thread');
            if (!thread) throw new Error('#thread not found');

            // ① 先找 textarea
            let textarea = thread.querySelector('article textarea');

            // ② textarea 不可见才点按钮
            if (!isVisible(textarea)) {
                const actionBtn = thread
                    .querySelector('article')
                    .querySelector('div.z-0.flex.justify-end button:nth-child(2)');

                if (!actionBtn) throw new Error('action button not found');

                actionBtn.click();

                // ✅ 等待 textarea 真的出现且可见（比 setTimeout(100) 更稳）
                textarea = await waitForVisibleTextarea(thread, 2000);
            }

            if (!textarea) throw new Error('textarea still not found/visible');

            // ✅ 用“人类输入链”写入，确保网页识别为有效输入
            fillTextareaHumanLike(textarea, text);

            console.log('✅ 已写入 textarea（框架可识别）');
        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    };

    document.body.appendChild(btn);
})();