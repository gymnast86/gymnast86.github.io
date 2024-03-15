import { load } from 'js-yaml';
import { ChangeEvent, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { ThunkResult, useAppDispatch } from './store/store';
import { TrackerState, loadTracker } from './tracker/slice';
import { RemoteReference } from './loader/LogicLoader';
import { Button } from 'react-bootstrap';
import defaultConfig from './data/defaultConfig.json';
import configData from './data/configData.json';
import _ from 'lodash';

const version = 'SSRANDO-TRACKER-NG-V2';

export interface ExportState {
    version: string;
    state: TrackerState;
    logicBranch: RemoteReference;
}

export interface YamlState {
    seed: string;
    generate_spoiler_log: boolean;
    use_plandomizer: boolean;
    plandomizer_file: string;
    "World 1": YamlWorld;
}

type YamlWorld = { [index: string]: string | Array<string> }

type ConfigMapper = { [index: string]: SDRMapping }

type MutableState = { [index: string]: string | number | boolean | Array<string> }

interface SDRMapping {
    name: string;
    options: { [index: string]: string | boolean}
}


function doExport(): ThunkResult {
    return (_dispatch, getState) => {
        const state = getState().tracker;
        const logicBranch = getState().logic.remote!;

        const filename = `SS-Rando-Tracker${new Date().toISOString()}`;
        const exportVal: ExportState = { state, version, logicBranch };
        const exportstring = JSON.stringify(exportVal, undefined, '\t');
        const blob = new Blob([exportstring], { type: 'json' });
        const e = document.createEvent('MouseEvents'); const
            a = document.createElement('a');
        a.download = `${filename}.json`;
        a.href = window.URL.createObjectURL(blob);
        a.dataset.downloadurl = ['json', a.download, a.href].join(':');
        e.initEvent('click');
        a.dispatchEvent(e);
    };
}

export function ExportButton() {
    const dispatch = useAppDispatch();
    const onClick = useCallback(() => {
        dispatch(doExport());
    }, [dispatch]);

    return (
        <Button onClick={onClick}>
            Export
        </Button>
    );
}

export function ImportButton({ setLogicBranch }: { setLogicBranch: (branch: RemoteReference) => void }) {
    const dispatch = useDispatch();

    const doImport = (text: string) => {
        const importVal = JSON.parse(text) as ExportState;
        if (importVal.version !== version) {
            alert('This export was made with an incompatible version of the Tracker and cannot be imported here.');
        }
        dispatch(loadTracker(importVal.state));
        setLogicBranch(importVal.logicBranch);
    };

    const readFile = (event: ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files?.length) {
            return;
        }
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = (e) => {
            if (!e.target?.result) {
                return;
            }
            doImport(e.target.result.toString())
        };
    }

    return (
        <>
            <label style={{ margin: 0, display: 'contents' }} htmlFor="importButton">
                <div className="btn btn-primary" style={{ display: 'flex', flexFlow: 'row', alignItems: 'center' }}>
                    Import Saved Run
                </div>
            </label>
            <input style={{ display: 'none' }} type="file" id="importButton" accept=".json" onChange={readFile} />
        </>
    );
}

export function ImportYamlButton({ setLogicBranch }: { setLogicBranch: (branch: RemoteReference) => void }) {
    const dispatch = useDispatch();


    const doYamlImport = (text: string) => {
        const importVal = load(text) as YamlState;
        const settings = importVal["World 1"];
        const defaultExport = defaultConfig as ExportState;
        const defaultState = defaultConfig.state as TrackerState;
        const settingsToLoad = defaultState.settings as MutableState;
        const configMap = configData as ConfigMapper;
        _.forEach(settings, (data, setting) => {
            if (setting in configData) {
                const settingData = configMap[setting];
                if (typeof data === 'string') {
                    settingsToLoad[settingData.name] = settingData.options[data];
                }
            }
        });
        let excludedLocs: Array<string> = [];
        if (settings.goddess_chest_shuffle === "off") {
            // default excluded locations has all goddess chests. kinda hacky way to do it but w/e
            excludedLocs = settingsToLoad["excluded-locations"] as Array<string>;
        }
        _.forEach(settings.excluded_locations, (loc) => {
            let newLoc = loc;
            // lots of hacky stuff for problematic old names -- definitely missing some still but this is a fine start
            newLoc = newLoc.replace('Skyview Temple - ','Skyview - ');
            newLoc = newLoc.replace('The Sky - ','Sky - ');
            newLoc = newLoc.replace('The Thunderhead - ','Thunderhead - ');
            newLoc = newLoc.replace('Isle of Songs - ','Thunderhead - Isle of Songs - ');
            newLoc = newLoc.replace('Lumpy Pumpkin - ','Sky - Lumpy Pumpkin - ');
            newLoc = newLoc.replace('Lumpy Pumpkin - Kina\'s Crystals', 'Kina\'s Crystals');
            newLoc = newLoc.replace('Knight Academy - ','Upper Skyloft - ');
            newLoc = newLoc.replace('Sparring Hall - Chest', 'Upper Skyloft - Sparring Hall Chest');
            newLoc = newLoc.replace('Bazaar - ','Central Skyloft - ');
            newLoc = newLoc.replace('Bird\'s Nest', 'Bird Nest');
            newLoc = newLoc.replace('Batreaux - ','Batreaux\'s House - ');
            newLoc = newLoc.replace('Collect all Tears Reward','Trial Reward');
            newLoc = newLoc.replace('Bug Heaven - Minigame -- ','Thunderhead - Bug Heaven -- ');
            newLoc = newLoc.replace('Shipyard - ', 'Lanayru Sand Sea - ');
            newLoc = newLoc.replace('Fun Fun Island - Minigame -- ','Sky - Fun Fun Island Minigame -- ');
            newLoc = newLoc.replace('The Goddess\'s Silent Realm','Skyloft Silent Realm');
            newLoc = newLoc.replace('Farore\'s Silent Realm','Faron Silent Realm');
            newLoc = newLoc.replace('Din\'s Silent Realm','Eldin Silent Realm');
            newLoc = newLoc.replace('Nayru\'s Silent Realm','Lanayru Silent Realm');
            excludedLocs.push(newLoc);
        })
        if (settings.npc_closet_shuffle === "vanilla") {
            excludedLocs.push('Upper Skyloft - In Zelda\'s Closet');
        }
        const startingItems = settings.starting_inventory;
        settingsToLoad["excluded-locations"] = excludedLocs;
        settingsToLoad["starting-items"] = startingItems;
        settingsToLoad["damage-multiplier"] = settings.damage_multiplier;
        settingsToLoad["starting-tablet-count"] = settings.random_starting_tablet_count;
        defaultState.settings = settingsToLoad;
        dispatch(loadTracker(defaultState));
        setLogicBranch(defaultExport.logicBranch);
    };

    const readYaml = (event: ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files?.length) {
            return;
        }
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = (e) => {
            if (!e.target?.result) {
                return;
            }
            doYamlImport(e.target.result.toString())
        };
    }

    return (
        <>
            <label style={{ margin: 0, display: 'contents' }} htmlFor="importYamlButton">
                <div className="btn btn-primary" style={{ display: 'flex', flexFlow: 'row', alignItems: 'center' }}>
                    Import config.yaml
                </div>
            </label>
            <input style={{ display: 'none' }} type="file" id="importYamlButton" accept=".yaml" onChange={readYaml} />
        </>
    );
}

