/**
 * @license
 * Copyright 2016 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import debounce from 'lodash/debounce';
import {WatchableValue} from 'neuroglancer/trackable_value';
import {RefCounted} from 'neuroglancer/util/disposable';
import {urlSafeParse, urlSafeStringify, verifyObject} from 'neuroglancer/util/json';
import {getCachedJson, Trackable, CompoundTrackable} from 'neuroglancer/util/trackable';

/**
 * @file Implements a binding between a Trackable value and the URL hash state.
 */

/**
 * An instance of this class manages a binding between a Trackable value and the URL hash state.
 * The binding is initialized in the constructor, and is removed when dispose is called.
 */
export class UrlHashBinding extends RefCounted {
  /**
   * Most recently parsed or set state string.
   */
  private prevStateString: string|undefined;

  /**
   * Generation number of previous state set.
   */
  private prevStateGeneration: number|undefined;
  private prevLayerGeneration: number|undefined;

  /**
   * Most recent error parsing URL hash.
   */
  parseError = new WatchableValue<Error|undefined>(undefined);

  constructor(public root: Trackable, updateDelayMilliseconds = 200) {
    super();
    this.registerEventListener(window, 'hashchange', () => this.updateFromUrlHash());
    const throttledSetUrlHash = debounce(() => this.setUrlHash(), updateDelayMilliseconds);
    this.registerDisposer(root.changed.add(throttledSetUrlHash));
    this.registerDisposer(() => throttledSetUrlHash.cancel());
  }

  /*
   * Check if layer changed
   */
  checkLayerChange(): boolean {
    let is_changed = false;
    // If root has children
    if (this.root instanceof CompoundTrackable) { 
      let layerState = this.root.children.get('layers');
      if (layerState) {
        // Check if layer change count has increased
        let generation = layerState.changed.count;
        if (generation !== this.prevLayerGeneration) {
          // Only change if if not first generation
          if (this.prevLayerGeneration !== undefined) {
            is_changed = true; 
          }
          this.prevLayerGeneration = generation; 
        }
      }
    }
    return is_changed;
  }

  /*
   * Replaces current state, and may push state to history
   */
  updateHistory(stateString: string) {
    let historyAction = history.replaceState.bind(history);
    if (this.checkLayerChange()) {
      // Push to history if layer changed
      historyAction = history.pushState.bind(history); 
    }
    // Replace or push to history
    if (stateString === '{}') {
      historyAction(null, '', '#');
    } else {
      historyAction(null, '', '#!' + stateString);
    }
  }

  /**
   * Sets the URL hash to match the current state.
   */
  setUrlHash() {
    const cacheState = getCachedJson(this.root);
    const {generation} = cacheState;
    // Check if any part of state has changed
    if (generation !== this.prevStateGeneration) {
      this.prevStateGeneration = cacheState.generation;
      let stateString = urlSafeStringify(cacheState.value);
      // Check if state string has changed
      if (stateString !== this.prevStateString) {
        this.prevStateString = stateString;
        // Update current or past history
        this.updateHistory(stateString);
      }
    }
  }

  /**
   * Sets the current state to match the URL hash.  If it is desired to initialize the state based
   * on the URL hash, then this should be called immediately after construction.
   */
  updateFromUrlHash() {
    try {
      let s = location.href.replace(/^[^#]+/, '');
      if (s === '' || s === '#' || s === '#!') {
        s = '#!{}';
      }
      if (s.startsWith('#!+')) {
        s = s.slice(3);
        // Firefox always %-encodes the URL even if it is not typed that way.
        s = decodeURI(s);
        let state = urlSafeParse(s);
        verifyObject(state);
        this.root.restoreState(state);
        this.prevStateString = undefined;
      } else if (s.startsWith('#!')) {
        s = s.slice(2);
        s = decodeURI(s);
        if (s === this.prevStateString) {
          return;
        }
        this.prevStateString = s;
        this.root.reset();
        let state = urlSafeParse(s);
        verifyObject(state);
        this.root.restoreState(state);
      } else {
        throw new Error(`URL hash is expected to be of the form "#!{...}" or "#!+{...}".`);
      }
      this.parseError.value = undefined;
    } catch (parseError) {
      this.parseError.value = parseError;
    }
  }
}
