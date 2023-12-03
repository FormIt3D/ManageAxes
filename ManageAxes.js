if (typeof ManageAxes == 'undefined')
{
    ManageAxes = {};
}

/*** web/UI code - runs natively in the plugin process ***/

ManageAxes.initializeUI = async function()
{
    // create an overall container for all objects that comprise the "content" of the plugin
    // everything except the footer
    let contentContainer = document.createElement('div');
    contentContainer.id = 'contentContainer';
    contentContainer.className = 'contentContainer'
    window.document.body.appendChild(contentContainer);

    // create the header
    contentContainer.appendChild(new FormIt.PluginUI.HeaderModule('Manage Axes', 'Tools to customize the local coordinate system.').element);

    // separator and space
    contentContainer.appendChild(document.createElement('p'));
    contentContainer.appendChild(document.createElement('hr'));
    contentContainer.appendChild(document.createElement('p'));

    // create the subsection for setting the LCS at the selected face 
    contentContainer.appendChild(new FormIt.PluginUI.HeaderModule('Align Workplane with Face', 'Align the local coordinate system workplane with the selected face.').element);

    // create the button to set the LCS on the selected face
    contentContainer.appendChild(new FormIt.PluginUI.Button('Align Workplane with Face', ManageAxes.setLCSOnSelectedFace).element);

    // separator and space
    contentContainer.appendChild(document.createElement('p'));
    contentContainer.appendChild(document.createElement('hr'));
    contentContainer.appendChild(document.createElement('p'));

    // create the subsection for re-origining: moving geometry back to the world origin, then transforming the instance to where the geometry was
    contentContainer.appendChild(new FormIt.PluginUI.HeaderModule('Re-Origin Current Context', 'Set the origin of the current editing history to the bottom centroid of all geometry.').element);

    // create the button for reset axes
    contentContainer.appendChild(new FormIt.PluginUI.ButtonWithInfoToggleModule('Re-Origin Current Context', "Moves all geometry in the current editing history (group) to the world origin, then applies the reverse transform to all instances of this history (group). <br><br>Helps fix numeric noise issues caused by working too far from the world origin. <br><br>Note that this only works when editing a group.", ManageAxes.reOrigin).element);

    // separator and space
    contentContainer.appendChild(document.createElement('p'));
    contentContainer.appendChild(document.createElement('hr'));
    contentContainer.appendChild(document.createElement('p'));

    // create the subsection for standard tools
    contentContainer.appendChild(new FormIt.PluginUI.HeaderModule('Standard Tools', 'Easier access to tools from the FormIt context menu.').element);

    // create the button for set axes
    contentContainer.appendChild(new FormIt.PluginUI.ButtonWithInfoToggleModule('Set Axes Manually', 'The standard FormIt tool to manually locate and adjust the local coordinate system axes. \nMove your cursor into canvas to set the LCS origin, then use the grips to adjust the axes.', ManageAxes.startSetAxesTool).element);

    // create the button for reset axes
    contentContainer.appendChild(new FormIt.PluginUI.ButtonWithInfoToggleModule('Reset Axes to Default', 'The standard FormIt tool to reset the local coordinate system axes to the default values.', ManageAxes.resetAxes).element);
    

    // create the footer
    document.body.appendChild(new FormIt.PluginUI.FooterModule().element);
}

/*** application code - runs asynchronously from plugin process to communicate with FormIt ***/

// the editing context
let nHistoryID;

// if a single face is selected, returns its ID
// otherwise, returns -1
ManageAxes.getAlignmentFaceID = async function()
{
    nHistoryID = await FormIt.GroupEdit.GetEditingHistoryID();

    let currentSelection = await FormIt.Selection.GetSelections();
    
    if (currentSelection.length == 1)
    {
        // if not in the Main History, need to calculate the depth to extract the correct history data
        let historyDepth = (currentSelection[0]["ids"].length) -1;
        //console.log("Current history depth: " + historyDepth);

        let nObjectID = currentSelection[0]["ids"][historyDepth]["Object"];
        let objectType = await WSM.APIGetObjectTypeReadOnly(nHistoryID, nObjectID);
        console.log("Object type: " + objectType);

        if (objectType == WSM.nObjectType.nFaceType)
        {
            return nObjectID;
        }
        else 
        {
            return -1;
        }
    }
    else
    {
        return -1;
    }
}

ManageAxes.setLCSOnSelectedFace = async function()
{
    // get the selected face ID
    // if -1, the selection is not valid
    let nAlignmentFaceID = await ManageAxes.getAlignmentFaceID();

    if (nAlignmentFaceID != -1)
    {
        // get the centroid of the face
        let faceCentroidPoint3D = await WSM.APIGetFaceCentroidPoint3dReadOnly(nHistoryID, nAlignmentFaceID);
        console.log("Face centroid: " + JSON.stringify(faceCentroidPoint3D));

        // get the normal at the centroid
        let normals = await WSM.APIGetFaceVertexNormalsReadOnly(nHistoryID, nAlignmentFaceID);
        console.log("Normals: " + JSON.stringify(normals));

        let faceNormal = normals[0]["second"];
        let zAxisVector = [faceNormal["x"], faceNormal["y"], faceNormal["z"]];

        // set an arbitrary x-axis to start
        let xAxisVector = [1, 0, 0];
        // check if xAxis is in the same direction as zAxis, and if so, change the arbitrary xAxis vector
        if (1 - Math.abs(dotProductVector(zAxisVector, xAxisVector)) < 1.0e-10)
        {
            //console.log("Switching xAxis...");
            xAxisVector = [0, 1, 0];
        }
    
        // determine the y-axis using cross-product of X and Z
        // this function is stored in utils
        let yAxisVector = crossProductVector(zAxisVector, xAxisVector);
        //console.log(JSON.stringify("Profile surface Y-axis vector: " + JSON.stringify(yAxisWSMVector3d)));
    
        // recalculate the actual x-axis vector, using cross-product of Y and Z
        // this function is stored in utils
        xAxisVector = crossProductVector(yAxisVector, zAxisVector);
        //console.log(JSON.stringify("Profile surface X-axis vector: " + JSON.stringify(xAxisWSMVector3d)));

        // convert the raw vectors to WSM vector3Ds
        let xAxisVector3d = await WSM.Geom.Vector3d(xAxisVector[0], xAxisVector[1], xAxisVector[2]);
        let yAxisVector3d = await WSM.Geom.Vector3d(yAxisVector[0], yAxisVector[1], yAxisVector[2]);
        let zAxisVector3d = await WSM.Geom.Vector3d(zAxisVector[0], zAxisVector[1], zAxisVector[2]);

        // create a new transf3d at the face centroid
        let newLCS = await WSM.Geom.MakeRigidTransform(faceCentroidPoint3D, xAxisVector3d, yAxisVector3d, zAxisVector3d);
        console.log("New LCS: " + JSON.stringify(newLCS));

        let facePlane = await WSM.APIGetFacePlaneReadOnly(nHistoryID, nAlignmentFaceID);
        console.log("Face plane: " + JSON.stringify(facePlane));

        // set the new LCS
        await WSM.APISetLocalCoordinateSystem(nHistoryID, newLCS);
    }
    else 
    {
        let failureMessage = "Select a single face to align the workplane to."
        await FormIt.UI.ShowNotification(failureMessage, FormIt.NotificationType.Information, 0);
    }
}

// wrapper function for starting the FormIt set axes tool
ManageAxes.startSetAxesTool = async function()
{
    await FormIt.Tools.StartTool(15);
}

// reset the axes to the default position/alignment
ManageAxes.resetAxes = async function()
{
    nHistoryID = await FormIt.GroupEdit.GetEditingHistoryID();
    let defaultLCS = await WSM.Geom.MakeRigidTransform(await WSM.Geom.Point3d(0, 0, 0), await WSM.Geom.Vector3d(1, 0, 0), await WSM.Geom.Vector3d(0, 1, 0), await WSM.Geom.Vector3d(0, 0, 1));

    await WSM.APISetLocalCoordinateSystem(nHistoryID, defaultLCS);
}

// moves all geometry in the current editing history to the world origin, then applies the reverse transform to the group
ManageAxes.reOrigin = async () => {
    // get the current editing group instance path
    const editingPath = await FormIt.GroupEdit.GetInContextEditingPath();
    const finalEditingObjectHistoryId = await WSM.GroupInstancePath.GetTopObjectHistoryID(editingPath);
    const editingHistoryId = await FormIt.GroupEdit.GetEditingHistoryID();
    const parentHistoryId = finalEditingObjectHistoryId.History;

    // this action won't be valid for the main history
    if (editingHistoryId === 0) {
        await FormIt.UI.ShowNotification("This action requires a group to be edited. \nEdit a group and try again.", FormIt.NotificationType.Error, 0)
        return;
    }

    // start a new undo state
    await FormIt.UndoManagement.BeginState();

    // get the bounding box of the editing history and its upper and lower bounds
    const editingBBox = await WSM.APIGetBoxReadOnly(parentHistoryId, editingPath.ids[0].Object);

    // make a translation transform to the world origin
    const vec3d = await WSM.Geom.Vector3d(-(editingBBox.lower.x + editingBBox.upper.x) / 2, -(editingBBox.lower.y + editingBBox.upper.y) / 2, -editingBBox.lower.z);
    const geomTransf3d = await WSM.Transf3d.MakeTranslationTransform(vec3d);
    // get the inverse transform for use later
    const inverseGeomTransf3d = await WSM.Transf3d.Invert(geomTransf3d);

    // get all the non-owned objects in this history
    const objectIds = await WSM.APIGetAllNonOwnedReadOnly(editingHistoryId);
    // and move them to the world origin
    await WSM.APITransformObjects(editingHistoryId, objectIds, geomTransf3d);

    // get all the instances of this history
    const instancesOfHistory = await WSM.APIGetAllAggregateTransf3dsReadOnly(editingHistoryId, 0);
    console.log(instancesOfHistory);

    // for each instance...
    for (let i = 0; i < instancesOfHistory.paths.length; i++) {
        // how many levels "deep" is this instance from history 0
        const historyDepthIndex = instancesOfHistory.paths[i].ids.length - 1;
        const instanceObjectHistoryId = instancesOfHistory.paths[i].ids[historyDepthIndex];
        console.log(instanceObjectHistoryId);
        // get the instance's transform and the inverse
        const instanceTransf3d = instancesOfHistory.transforms[i];
        const inverseInstanceTransf3d = await WSM.Transf3d.Invert(instanceTransf3d);
        // multiply instance transform, instance inverse transform, and geom inverse transform
        const newTransf3dPartial = await WSM.Transf3d.Multiply(instanceTransf3d, inverseGeomTransf3d);
        const newTransf3dFinal = await WSM.Transf3d.Multiply(newTransf3dPartial, inverseInstanceTransf3d);
        // transform the instance by the final transf3d
        await WSM.APITransformObject(instanceObjectHistoryId.History, instanceObjectHistoryId.Object, newTransf3dFinal);
    }

    // reset the local origin (this gets moved along with the non-owned objects)
    const defaultLCS = await WSM.Geom.MakeRigidTransform(await WSM.Geom.Point3d(0, 0, 0), await WSM.Geom.Vector3d(1, 0, 0), await WSM.Geom.Vector3d(0, 1, 0), await WSM.Geom.Vector3d(0, 0, 1));
    await WSM.APISetLocalCoordinateSystem(editingHistoryId, defaultLCS);

    await FormIt.UndoManagement.EndState("Manage Axes - Re-Origin");

    return;
}
