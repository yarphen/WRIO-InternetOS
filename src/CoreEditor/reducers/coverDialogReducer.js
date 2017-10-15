/**
 * Created by michbil on 16.07.17.
 */

import { combineReducers } from "redux";
import { COVER_DIALOG_OPEN, COVER_DIALOG_CLOSE } from "../actions/coverDialog";

const defaultState = {
  showDialog: false
};

export function imageDialogReducer(state = defaultState, action) {
  const { titleValue, urlValue, descValue, linkEntityKey } = action;
  switch (action.type) {
    case COVER_DIALOG_OPEN:
      return {
        ...state,
        showDialog: true
      };
    case COVER_DIALOG_CLOSE:
      return { ...state, showDialog: false };

    default:
      return state;
  }
}

export default imageDialogReducer;
