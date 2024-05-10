import { ChangeEvent, SetStateAction } from "react"
import "./Settings.css"
import { Fragment } from "react";
import { LOCAL_STORAGE_KEY, SettingsConfig, loadSettings, makeDefaultConfig } from "../utilities/settings";

/**
 * 
 * @param props props
 * @param props.settings Settings state variable
 * @param props.setSettings setter for settings state variable
 * @returns Settings Page
 */
export function Settings(
    {settings, setSettings}:
    {settings: SettingsConfig, setSettings: React.Dispatch<SetStateAction<SettingsConfig>>}
) {
    
    const updateSettings = (field: keyof SettingsConfig, event: ChangeEvent<HTMLInputElement>) => {
        settings[field] = event.target.value as unknown as number;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
        setSettings(settings);
    };

    const resetConfig = () => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(makeDefaultConfig()));
        setSettings(loadSettings());
    };

    return (
        <>
            <main className="settings-page">
                <form>
                    <legend>Settings</legend>

                    {Object.keys(settings).map(
                        (field, i) =>
                            <Fragment key={i + settings[field as keyof SettingsConfig]}>
                                <label>
                                    {field}
                                    <input
                                        onChange={(e) => updateSettings(field as keyof SettingsConfig, e)}
                                        defaultValue={settings[field as keyof SettingsConfig]}
                                        type="number"
                                        />
                                </label>
                            </Fragment>
                    )}

                    <input id='reset' type="button" value="Reset to Default" onClick={resetConfig}/>
                </form>
            </main>
        </>
    );
}

export default Settings;