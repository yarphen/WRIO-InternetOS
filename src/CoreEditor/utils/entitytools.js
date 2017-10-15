/**
 * Created by michbil on 20.12.16.
 */

import {
  AtomicBlockUtils,
  CompositeDecorator,
  ContentState,
  SelectionState,
  Editor,
  EditorState,
  Entity,
  RichUtils,
  CharacterMetadata,
  getDefaultKeyBinding,
  Modifier,
  convertToRaw
} from "draft-js";
import { getImageObject } from "../JSONDocument.js";
import insertAtomicBlock from "./insertAtomicBlock.js";

var linkEditCallback;
var imageEditCallback;
import LinkEntity from "../EditorEntities/LinkEntity.js";
import ImageEntity from "../EditorEntities/ImageEntitiy.js";
import SocialMediaEntity from "../EditorEntities/SocialMediaEntity.js";

const isImageLink = filename => /\.(gif|jpg|jpeg|tiff|png)$/i.test(filename);
const TECHNICAL_BLOCK_ID = "[TECHNICAL_BLOCK_PLEASE_DONT_SHOW_IT]";

export default class EntityTools {
  static setLinkEditCallback(cb) {
    linkEditCallback = cb;
  }
  static setImageEditCallback(cb) {
    imageEditCallback = cb;
  }

  /**
     * Creates link entity
     * @param title
     * @param url
     * @param desc
     * @returns {LINK}
     */
  static createLinkEntity(title: string, url: string, desc: string) {
    return Entity.create("LINK", "MUTABLE", {
      linkTitle: title,
      linkUrl: url,
      linkDesc: desc,
      editCallback: linkEditCallback
    });
  }

  /**
     * Creates image or social entity
     * @param url
     * @param description
     * @param title
     * @returns {urlType}
     */
  static createImageSocialEntity(
    url: string,
    description: string,
    title: string
  ) {
    const urlType = isImageLink(url) ? "IMAGE" : "SOCIAL";
    const entityKey = Entity.create(urlType, "IMMUTABLE", {
      src: url,
      description,
      title,
      editCallback: imageEditCallback
    });
    return entityKey;
  }

  /** 
     * inserts entity key into editorState */
  static insertEntityKeyIntoAtomicBlock(
    editorState: EditorState,
    entityKey: string,
    insertEmpty: boolean
  ) {
    const key = editorState.getSelection().getAnchorKey();
    const newEditorState = insertAtomicBlock(
      editorState, // its added because of facebook issue https://github.com/facebook/draft-js/issues/203
      entityKey,
      TECHNICAL_BLOCK_ID,
      key,
      insertEmpty
    );
    return newEditorState;
  }

  static _getMentionContentBlock(
    contentBlocks: Map<string, ContentBlock>,
    mention: Object
  ) {
    const block = contentBlocks[mention.block];

    if (!block) {
      console.warn("Cannot create mention", mention);
      throw new Error("Mention create error");
    }
    return block;
  }

  static _constructEntity(
    entityKey: string,
    editorState: EditorState,
    contentBlocks: Map<string, ContentBlock>,
    mention: Object
  ) {
    console.log(entityKey, mention);
    try {
      const key = this._getMentionContentBlock(contentBlocks, mention).getKey();
      console.log("mention paragraph key", key);
      return RichUtils.toggleLink(
        editorState,
        SelectionState.createEmpty(key).merge({
          anchorOffset: mention.start,
          focusKey: key,
          focusOffset: mention.end
        }),
        entityKey
      );
    } catch (e) {
      console.error("Error mapping a mention", e);
      return editorState;
    }
  }

  /**
     * Inserts mention into editor state
     * @param editorState
     * @param contentBlocks
     * @param mention
     * @returns {*} new editorState
     */

  static constructMention(editorState: EditorState, contentBlocks, mention) {
    const entityKey = this.createLinkEntity(
      mention.linkWord,
      mention.url,
      mention.linkDesc
    );
    return this._constructEntity(
      entityKey,
      editorState,
      contentBlocks,
      mention
    );
  }

  /**
     * Inserts image into editorState
     * @param editorState
     * @param contentBlocks
     * @param mention
     * @returns {*} new editorState
     */

  static constructImage(editorState, contentBlocks, mention, insertEmpty) {
    const blockKey = this._getMentionContentBlock(
      contentBlocks,
      mention
    ).getKey();
    const blockData = getImageObject(
      mention.src,
      mention.name,
      mention.description
    );

    return this.constructSocial(editorState, blockKey, blockData, insertEmpty);
  }

  /**
     * Inserts social entity into editorState from metablock generated by LDJSONDocument
     * @param editorState - prev editorState
     * @param metaBlock
     * @returns {*} new editorState
     */

  static constructSocial(editorState, blockKey, blockData, insertEmpty = true) {
    let entityKey;
    if (blockData["@type"] == "ImageObject") {
      entityKey = this.createImageSocialEntity(
        blockData.contentUrl,
        blockData.name,
        blockData.description
      );
    } else {
      entityKey = this.createImageSocialEntity(
        blockData.sharedContent.url,
        blockData.sharedContent.headline,
        blockData.sharedContent.about
      );
    }
    const _editorState = EditorState.forceSelection(
      editorState,
      SelectionState.createEmpty(blockKey)
    ); // We are creating entity in wrong place!!!
    return EntityTools.insertEntityKeyIntoAtomicBlock(
      _editorState,
      entityKey,
      insertEmpty
    );
  }
}

export const getSelection = editorState => {
  var title = "";
  const selectionState = editorState.getSelection();
  const blockKey = selectionState.getAnchorKey();
  const contentBlocks = editorState.getCurrentContent().getBlocksAsArray();
  var start = selectionState.getStartOffset();
  var end = selectionState.getEndOffset();

  contentBlocks.forEach(block => {
    if (block.key === blockKey) {
      title = block.text.slice(start, end);
    }
  });
  return title;
};

// helper function that finds entities in contentblocks
const findEntitiesOfType = type => (contentBlock, callback) => {
  contentBlock.findEntityRanges(character => {
    const entityKey = character.getEntity();
    return !!entityKey && Entity.get(entityKey).getType() === type;
  }, callback);
};

export const findLinkEntities = findEntitiesOfType("LINK");
export const findImageEntities = findEntitiesOfType("IMAGE");
export const findSocialEntities = findEntitiesOfType("SOCIAL");

/**
 * !!!!!!!!!! IMPORTER !!!!!!!!!!!!!!!!
 * Main fuction, that constructs EditorState from LD+JSON data
 * @param {*} contentBlock wrapped content blocks with
 * @param {*} mentions 
 * @param {*} images 
 */
export function createEditorState({
  contentBlocks,
  mentions,
  images,
  socials,
  blockKeyToOrderMap
}) {
  const decorator = new CompositeDecorator([
    {
      strategy: findLinkEntities,
      component: LinkEntity
    },
    {
      strategy: findImageEntities,
      component: ImageEntity
    },
    {
      strategy: findSocialEntities,
      component: SocialMediaEntity
    }
  ]);

  //    console.log("OrderedBlocks after import:");
  //  console.log(socials)
  const valuesToKeys = (hash, block: ContentBlock) => {
    //      console.log("BLOCK", value.order, e.getType(),e.getText());
    let key = blockKeyToOrderMap[block["key"]] + 1;
    hash[key] = block;
    return hash;
  };
  const orderedBlocks = contentBlocks.reduce(valuesToKeys, {});
  //console.log(orderedBlocks);

  let editorState =
    contentBlocks.length > 0 // so let's create new EditorState there!!!
      ? EditorState.createWithContent(
          ContentState.createFromBlockArray(contentBlocks),
          decorator
        )
      : EditorState.createEmpty(decorator);

  editorState = socials.reduce(
    (editorState, social) =>
      EntityTools.constructSocial(editorState, social.key, social.data, false),
    editorState
  );
  if (images) {
    editorState = images.reduce(
      (editorState, mention) =>
        EntityTools.constructImage(editorState, orderedBlocks, mention, false),
      editorState
    );
  }

  return mentions.reduce(
    (editorState, mention) =>
      EntityTools.constructMention(editorState, orderedBlocks, mention),
    editorState
  );
}

function appendHttp(url) {
  if (!/^https?:\/\//i.test(url)) {
    return "http://" + url;
  }
  return url;
}

export function createNewLink(editorState, titleValue, urlValue, descValue) {
  urlValue = appendHttp(urlValue);

  const entityKey = EntityTools.createLinkEntity(
    titleValue,
    urlValue,
    descValue
  );

  const e = Entity.get(entityKey).getData();
  console.log(e);

  let _editorState = RichUtils.toggleLink(
    editorState,
    editorState.getSelection(),
    entityKey
  );
  return _editorState;
}

export function createNewImage(
  editorState,
  url,
  description,
  title,
  insertEmpty
) {
  const entityKey = EntityTools.createImageSocialEntity(
    url,
    description,
    title
  );
  return EntityTools.insertEntityKeyIntoAtomicBlock(
    editorState,
    entityKey,
    insertEmpty
  );
}

export function extractTableOfContents(editorState) {
  const blockMap: OrderedMap = editorState.getCurrentContent().getBlockMap();
  return blockMap
    .filter(block => block.type == "header-two")
    .map(block => block.text)
    .toArray();
}

export function removeEntity(editorState, entityKeyToRemove) {
  let newState = editorState;
  console.warn(
    "Functions seems to be working not quite right, please check if everything is ok"
  );

  editorState
    .getCurrentContent()
    .getBlockMap()
    .map(block => {
      block.findEntityRanges(
        char => {
          let entityKey = char.getEntity();
          return !!entityKey && entityKey === entityKeyToRemove;
        },
        (anchorOffset, focusOffset) => {
          let _editorState = RichUtils.toggleLink(
            editorState,
            SelectionState.createEmpty(block.getKey()).merge({
              anchorOffset,
              focusKey: block.getKey(),
              focusOffset
            }),
            null
          );
          newState = _editorState;
        }
      );
    });
  return newState;
}
