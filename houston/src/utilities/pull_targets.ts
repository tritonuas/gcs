import { IdentifiedTarget, MatchedTarget } from '../protos/obc.pb';

export function pull_targets(setFoundItemArray: React.Dispatch<React.SetStateAction<IdentifiedTarget[]>>, setMatchedItemArray: React.Dispatch<React.SetStateAction<MatchedTarget[]>>) {
    fetch('/api/targets/all')
    .then(response => response.json())
    .then(data => {
        const IdentifiedTarget: IdentifiedTarget[] = data;
        console.log(IdentifiedTarget[0].Picture);
        setFoundItemArray(data);
    });

    fetch('/api/targets/matched')
    .then(response => response.json())
    .then(data => {
        const IdentifiedTarget: MatchedTarget[] = data;
        console.log(IdentifiedTarget);
        setMatchedItemArray(data);
    });
}