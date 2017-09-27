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

import {ChunkManager} from 'neuroglancer/chunk_manager/frontend';
import {DisplayContext} from 'neuroglancer/display_context';
import {LayerManager, MouseSelectionState} from 'neuroglancer/layer';
import {NavigationState} from 'neuroglancer/navigation_state';
import {TrackableBoolean} from 'neuroglancer/trackable_boolean';
import {RefCounted} from 'neuroglancer/util/disposable';
import {VisibilityPrioritySpecification} from 'neuroglancer/viewer_state';

export interface SliceViewViewerState {
  chunkManager: ChunkManager;
  navigationState: NavigationState;
  layerManager: LayerManager;
}

export interface ViewerUIState extends SliceViewViewerState, VisibilityPrioritySpecification {
  display: DisplayContext;
  mouseState: MouseSelectionState;
  perspectiveNavigationState: NavigationState;
  showPerspectiveSliceViews: TrackableBoolean;
  showAxisLines: TrackableBoolean;
  showScaleBar: TrackableBoolean;
}

export function getCommonViewerState(viewer: ViewerUIState) {
  return {
    mouseState: viewer.mouseState,
    layerManager: viewer.layerManager,
    showAxisLines: viewer.showAxisLines,
    visibility: viewer.visibility,
  };
}

export function NoEditor(element: HTMLElement) {
  return `No ${element.innerText}`;
}

export interface DataEditor extends RefCounted { rootElement: HTMLElement; }

export const EDITORS:
    [string, (element: HTMLElement) => string][] = [
      ['none', NoEditor],
      ['merge', NoEditor],
      ['split', NoEditor],
    ];