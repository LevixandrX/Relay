import type {BlockType} from './block-commands';
export const keywords:Record<BlockType,string>={
  text:'text paragraph текст абзац',h1:'h1 heading заголовок',h2:'h2 heading заголовок',h3:'h3 heading заголовок',h4:'h4 heading заголовок',
  bullet:'bullet list список маркированный',numbered:'number ordered list список нумерованный',todo:'todo task checklist задача чеклист',
  toggle:'toggle collapse details раскрывающийся список секция',quote:'quote цитата',callout:'callout note tip выноска заметка',code:'code код',divider:'divider line разделитель линия',prompt:'prompt ai ии запрос',
  table:'table grid таблица ячейки',image:'image photo picture изображение фото картинка',video:'video mp4 видео',audio:'audio music mp3 аудио музыка',file:'file upload attachment файл вложение загрузка',pdf:'pdf документ',
  bookmark:'bookmark link закладка ссылка',embed:'embed youtube vimeo figma loom встраивание',equation:'math latex equation formula математика формула уравнение',toc:'toc table of contents outline оглавление содержание',pageLink:'page link страница ссылка',
  toggleH1:'toggle h1 heading раскрывающийся заголовок',toggleH2:'toggle h2 heading раскрывающийся заголовок',toggleH3:'toggle h3 heading раскрывающийся заголовок',toggleH4:'toggle h4 heading раскрывающийся заголовок',
  columns2:'columns 2 колонки столбцы',columns3:'columns 3 колонки столбцы',columns4:'columns 4 колонки столбцы',columns5:'columns 5 колонки столбцы',
  inlineMath:'inline math equation latex строчная формула',
  page:'page new страница новая',
};
export function blockGroup(type:BlockType){if(['image','video','audio','file','pdf','bookmark','embed'].includes(type))return'media';if(type==='toc'||type==='equation'||type==='inlineMath'||type.startsWith('toggleH')||type.startsWith('columns'))return'advanced';if(['quote','callout','code','divider'].includes(type))return'formatting';if(type==='prompt')return'tools';return'basic';}
