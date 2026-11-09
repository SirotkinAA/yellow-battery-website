'use strict';
const embedConfigNode=document.getElementById('embed-config');
if(embedConfigNode){
 const config=JSON.parse(embedConfigNode.textContent);
 document.body.classList.add('embedded');
 document.documentElement.style.setProperty('--embed-accent',config.accent);
 document.documentElement.style.setProperty('--embed-background',config.background);
 document.documentElement.style.setProperty('--embed-text',config.text);
 document.documentElement.style.setProperty('--embed-radius',config.radius+'px');
 document.documentElement.style.setProperty('--embed-font',config.font==='serif'?'Georgia,serif':'Arial,Helvetica,sans-serif');
 language=config.language;applyLanguage();refreshHelp();
 const heading=document.querySelector('h1');heading.textContent=config.title;
 for(const button of document.querySelectorAll('[data-operation]'))button.hidden=!config.modes.includes(button.dataset.operation);
 get('operation').value=config.modes[0];mode();
 // Embedded language is set by the configuration, not the visitor's stored preference.
 document.querySelector('header').hidden=true;
}
