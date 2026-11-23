import en from './en.json' with {type:'json'};
import ko from './ko.json' with {type:'json'};
// Add a language pack and its native label here; UI and detection derive from this registry.
export const languages={en:{label:'English',translation:en},ko:{label:'한국어',translation:ko}};
export const fallbackLanguage='en';
