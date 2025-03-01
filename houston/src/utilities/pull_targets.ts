import { IdentifiedTarget, MatchedTarget } from "../protos/obc.pb";

/**
 *
 * @param setFoundItemArray set state for found items
 * @param setMatchedItemArray set state for matched items
 */
export async function pull_targets(
	setFoundItemArray: React.Dispatch<React.SetStateAction<IdentifiedTarget[]>>,
	setMatchedItemArray: React.Dispatch<React.SetStateAction<MatchedTarget[]>>
) {
	const response = await fetch("/api/targets/all");
	const data = (await response.json()) as IdentifiedTarget[];
	data.forEach((d) => {
		if (!("id" in d)) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(d as any).id = 0; // stupid hack because protobuf doesn't serialize 0 values
			console.log("fix id 0 in list of all targets");
		}
	});
	setFoundItemArray([...data]);

	const response1 = await fetch("/api/targets/matched");
	const data1 = (await response1.json()) as MatchedTarget[];
	data1.forEach((d) => {
		if (d.Target == undefined) {
			return;
		}

		if (!("id" in d.Target)) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(d.Target as any).id = 0; // stupid hack because protobuf doesn't serialize 0 values
			console.log("fix id 0 in list of matched targets");
		}
	});
	setFoundItemArray([...data]);
	setMatchedItemArray([...data1]);
}

/**
 *
 * @param targets array of matched targets
 * @returns boolean
 */
export async function post_targets(targets: { [key: string]: number }) {
	console.log(targets);

	// should probably update function signature to already take in this format but whatever
	// just doing quick hacks to get ready for competition

	const data = await fetch("/api/targets/matched", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(targets),
	});
	console.log("Success:", data);
	return true;
}
