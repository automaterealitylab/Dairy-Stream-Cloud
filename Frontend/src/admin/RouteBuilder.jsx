import MapView from "./MapView";
import BuildingList from "./BuildingList";

const RouteBuilder = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <MapView />
      <BuildingList />
    </div>
  );
};

export default RouteBuilder;
